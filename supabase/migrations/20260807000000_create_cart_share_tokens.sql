-- Cart share tokens: allow an admin to generate a one-time shareable link
-- that, when opened by a different user, REPLACES that user's existing cart
-- with a pre-populated set of items derived from a cake design.

-- =============================================================================
-- Table: cart_share_tokens
-- =============================================================================
-- One row per generated share link. The actual cart line-items live in
-- cakegenie_cart with session_id = cart_share_tokens.token::text, so the
-- main app's existing getCartPageData(...) query picks them up transparently.

create table if not exists public.cart_share_tokens (
    token            uuid    primary key default gen_random_uuid(),
    is_revoked       boolean not null default false,
    created_at       timestamptz not null default now(),
    expires_at       timestamptz not null default (now() + interval '7 days'),
    renewed_at       timestamptz,

    -- Admin-entered customer / delivery metadata. Stored here so the main
    -- app can pre-fill checkout fields for the receiving user.
    admin_order_date          date,
    admin_order_time_slot     text,
    admin_customer_name       text,
    admin_customer_contact    text,
    admin_delivery_address    text,
    admin_delivery_city       text,

    -- Convenience denormalization so an admin can see which design the token
    -- was generated from without joining through cakegenie_cart.
    design_slug              text,
    design_p_hash            text,

    constraint cart_share_tokens_expires_after_creation
        check (expires_at > created_at)
);

-- Index for TTL-based cleanup
create index if not exists idx_cart_share_tokens_expires_at
    on public.cart_share_tokens (expires_at);

-- =============================================================================
-- RLS
-- =============================================================================
-- Only service_role (admin API routes) can INSERT / UPDATE / DELETE.
-- The anon role can SELECT a single non-revoked, non-expired row by token
-- so the main app can fetch pre-filled metadata after the CartProvider
-- has loaded the shared cart items.

alter table public.cart_share_tokens enable row level security;
revoke all on table public.cart_share_tokens from public, anon, authenticated;

-- anon can read a single valid token's metadata (for pre-filling delivery info)
create policy "anon can read valid share token metadata"
    on public.cart_share_tokens
    for select
    to anon
    using (
        is_revoked = false
        and expires_at > now()
    );

-- service_role has full access (admin API routes use the service key)
grant all on public.cart_share_tokens to service_role;
grant usage on all sequences in schema public to service_role;

-- =============================================================================
-- RPC: admin_create_shared_cart
-- =============================================================================
-- Generates a share token, inserts a cart row keyed to that token as
-- session_id, and records metadata for checkout pre-filling.
create or replace function public.admin_create_shared_cart(
    p_slug               text,
    p_order_date         date,
    p_time_slot          text,
    p_customer_name      text,
    p_customer_contact   text,
    p_delivery_address   text,
    p_delivery_city      text,
    p_quantity           integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
    v_token            uuid;
    v_cache            record;
    v_cake_type        text;
    v_cake_thickness   text;
    v_cake_size        text;
    v_base_price       numeric;
    v_final_price      numeric;
    v_original_image   text;
    v_customized_image text;
    v_merchant_id      uuid;
    v_expires_at       timestamptz := now() + interval '7 days';
    v_customization_details jsonb;
begin
    -- 1. Resolve the design from cakegenie_analysis_cache by slug
    select
        slug,
        p_hash,
        analysis_json,
        price,
        original_image_url,
        studio_edited_image_url,
        merchant_id
    into v_cache
    from public.cakegenie_analysis_cache
    where slug = p_slug
    limit 1;

    if not found then
        raise exception 'Design slug not found: %', p_slug;
    end if;

    -- 2. Derive cart field values from analysis_json with sensible defaults
    v_cake_type     := coalesce((v_cache.analysis_json ->> 'cakeType'), '1 Tier');
    v_cake_thickness := coalesce((v_cache.analysis_json ->> 'cakeThickness'), '4 in');

    -- cakeSize may be absent from analysis_json — fall back to the same
    -- DEFAULT_SIZE_MAP the main customizer uses.
    v_cake_size := coalesce(
        (v_cache.analysis_json ->> 'cakeSize'),
        case v_cake_type
            when '1 Tier'               then '6" Round'
            when '2 Tier'                then '6"9"'
            when '3 Tier'                then '5"8"10"'
            when 'Square'                then '8x8'
            when 'Rectangle'             then '8x12'
            when '1 Tier Fondant'        then '6" Round Fondant'
            when '2 Tier Fondant'        then '6"9" Fondant'
            when '3 Tier Fondant'        then '5"8"10"Fondant'
            when 'Bento'                 then '4" Round'
            when 'Square Fondant'        then '8x8'
            when 'Rectangle Fondant'     then '8x12'
            when 'Cupcake'               then '2oz - 12 pieces'
            when 'Bento Cupcake Set'     then '4" Bento + 5 Cupcakes'
            else '6" Round'
        end
    );

    v_base_price  := coalesce(v_cache.price, 0);
    v_final_price := coalesce(v_cache.price, 0);

    v_original_image  := v_cache.original_image_url;
    v_customized_image := coalesce(v_cache.studio_edited_image_url, v_cache.original_image_url);

    v_merchant_id := v_cache.merchant_id;

    -- 3. Build a compact customization_details JSON so the cart item is
    --    self-describing (the receiving user will re-edit on the customizer
    --    if they want changes, but this gives a sensible starting snapshot).
    v_customization_details := jsonb_build_object(
        'flavors',                coalesce(v_cache.analysis_json -> 'flavors', '["Chocolate Cake"]'::jsonb),
        'cakeType',               v_cache.analysis_json ->> 'cakeType',
        'cakeThickness',          v_cache.analysis_json ->> 'cakeThickness',
        'cakeSize',               v_cache.analysis_json ->> 'cakeSize',
        'mainToppers',            coalesce(v_cache.analysis_json -> 'main_toppers', '[]'::jsonb),
        'supportElements',        coalesce(v_cache.analysis_json -> 'support_elements', '[]'::jsonb),
        'cakeMessages',           coalesce(v_cache.analysis_json -> 'cake_messages', '[]'::jsonb),
        'icingDesign',            coalesce(v_cache.analysis_json -> 'icing_design', '{}'::jsonb),
        'additionalInstructions', coalesce(v_cache.analysis_json ->> 'additional_instructions', ''),
        'analysisResult',         v_cache.analysis_json
    );

    -- 4. Generate the token
    v_token := gen_random_uuid();

    -- 5. Insert the cart row keyed to the token as session_id
    insert into public.cakegenie_cart (
        session_id,
        merchant_id,
        cake_type,
        cake_thickness,
        cake_size,
        base_price,
        addon_price,
        final_price,
        quantity,
        original_image_url,
        customized_image_url,
        customization_details,
        expires_at,
        client_request_id
    ) values (
        v_token::text,
        v_merchant_id,
        v_cake_type,
        v_cake_thickness,
        v_cake_size,
        v_base_price,
        0,
        v_final_price,
        p_quantity,
        v_original_image,
        v_customized_image,
        v_customization_details,
        v_expires_at,
        ('admin-share-' || v_token::text)::uuid
    );

    -- 6. Record the share-token metadata row
    insert into public.cart_share_tokens (
        token,
        design_slug,
        design_p_hash,
        admin_order_date,
        admin_order_time_slot,
        admin_customer_name,
        admin_customer_contact,
        admin_delivery_address,
        admin_delivery_city,
        expires_at
    ) values (
        v_token,
        v_cache.slug,
        v_cache.p_hash,
        p_order_date,
        p_time_slot,
        p_customer_name,
        p_customer_contact,
        p_delivery_address,
        p_delivery_city,
        v_expires_at
    );

    return jsonb_build_object(
        'token',          v_token::text,
        'design_slug',    v_cache.slug,
        'design_p_hash',  v_cache.p_hash,
        'cart_url',       'https://genie.ph/cart?share_token=' || v_token::text,
        'expires_at',     v_expires_at
    );
end;
$function$;

-- Grant execute to service_role only
revoke execute on function public.admin_create_shared_cart from public, anon, authenticated;
grant execute on function public.admin_create_shared_cart to service_role;

-- =============================================================================
-- RPC: admin_get_shared_cart_metadata
-- =============================================================================
-- Returns the metadata stored on a share token (for both admin inspection and
-- main-app pre-filling after the shared cart rows are loaded).
create or replace function public.admin_get_shared_cart_metadata(
    p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
    v_token uuid;
    v_row   cart_share_tokens%rowtype;
begin
    -- Validate UUID format early
    begin
        v_token := p_token::uuid;
    exception
        when invalid_text_representation then
            return jsonb_build_object('error', 'Invalid token format');
    end;

    select * into v_row
    from public.cart_share_tokens
    where token = v_token;

    if not found then
        return jsonb_build_object('error', 'Share token not found');
    end if;

    return jsonb_build_object(
        'token',                v_row.token::text,
        'is_revoked',           v_row.is_revoked,
        'created_at',           v_row.created_at,
        'expires_at',           v_row.expires_at,
        'renewed_at',           v_row.renewed_at,
        'admin_order_date',     v_row.admin_order_date,
        'admin_order_time_slot',v_row.admin_order_time_slot,
        'admin_customer_name',  v_row.admin_customer_name,
        'admin_customer_contact',v_row.admin_customer_contact,
        'admin_delivery_address',v_row.admin_delivery_address,
        'admin_delivery_city',  v_row.admin_delivery_city,
        'design_slug',          v_row.design_slug,
        'design_p_hash',        v_row.design_p_hash
    );
end;
$function$;

revoke execute on function public.admin_get_shared_cart_metadata from public, anon, authenticated;
grant execute on function public.admin_get_shared_cart_metadata to service_role;
-- anon can also call this (via the API route that forwards with PIN) because
-- the CartContext uses a public supabase client — but we gate through the API
-- route which checks the PIN. For direct anon RPC access we do NOT grant,
-- the main app will call via a protected API route or the anon-select policy
-- on the table suffices for direct table reads.
-- If needed, the main app can read the table directly via RLS (anon select).

-- =============================================================================
-- RPC: admin_renew_share_token
-- =============================================================================
-- Extends the expiry of an existing share token. Only callable by service_role
-- (i.e. through an authenticated admin API route).
create or replace function public.admin_renew_share_token(
    p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
    v_token uuid;
    v_new_expires timestamptz;
begin
    begin
        v_token := p_token::uuid;
    exception
        when invalid_text_representation then
            return jsonb_build_object('error', 'Invalid token format');
    end;

    v_new_expires := now() + interval '7 days';

    update public.cart_share_tokens
    set is_revoked = false,
        expires_at = v_new_expires,
        renewed_at = now()
    where token = v_token;

    if not found then
        return jsonb_build_object('error', 'Share token not found');
    end if;

    return jsonb_build_object(
        'token',      v_token::text,
        'expires_at', v_new_expires
    );
end;
$function$;

revoke execute on function public.admin_renew_share_token from public, anon, authenticated;
grant execute on function public.admin_renew_share_token to service_role;

-- =============================================================================
-- Comment
-- =============================================================================
comment on table public.cart_share_tokens is
    'One-time share tokens generated by admin create-order flow. Cart line-items are stored in cakegenie_cart with session_id = token::text.';
