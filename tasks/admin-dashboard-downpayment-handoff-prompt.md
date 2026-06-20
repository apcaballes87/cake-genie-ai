# Genie Admin Dashboard Prompt: 50% Downpayment Support

Use the prompt below in the Genie admin dashboard repo or share it directly with the dashboard developers.

---

You are working in `/Users/apcaballes/genie.ph-admin-dashboard`.

The Genie.ph storefront now supports a **50% downpayment** flow for selected orders. This was implemented in the storefront repo `/Users/apcaballes/genieph-nextjs` on top of the existing split-payment / contribution framework, but it behaves differently from the older "split with friends" sharing flow.

I need you to update the admin dashboard so operations staff can correctly understand, view, and manage these downpayment orders without confusing them with normal fully paid orders or generic split-bill orders.

## Business Rules You Must Understand First

1. A `50% downpayment` order is still stored as a split order, but it is identified specifically by:
   - `cakegenie_orders.is_split_order = true`
   - `cakegenie_orders.split_message = 'downpayment_50'`
   - `cakegenie_orders.split_count = 2`

2. The first payment is an **exact 50% downpayment**.
   - After that first payment succeeds:
     - `cakegenie_orders.payment_status = 'partial'`
     - `cakegenie_orders.order_status = 'confirmed'`
     - `cakegenie_orders.amount_collected` reflects the paid amount

3. The second payment is the **exact remaining balance**.
   - After the remaining balance is fully paid:
     - `cakegenie_orders.payment_status = 'paid'`
     - `cakegenie_orders.order_status = 'confirmed'`
     - `cakegenie_orders.amount_collected = cakegenie_orders.total_amount`

4. A downpayment order being `confirmed` does **not** mean it is fully paid.
   - `confirmed + partial` means the booking is accepted, but there is still a balance due.
   - Delivery or release should only proceed after full payment is received.

5. This flow uses `order_contributions` under the hood, but unlike normal split sharing:
   - the order organizer is the only person allowed to create the 50% downpayment invoice and the remaining-balance invoice
   - the amount must be exact
   - the flow should be treated as a structured deposit flow, not an open-ended split contribution campaign

## Storefront Files That Implement This

Review these files in `/Users/apcaballes/genieph-nextjs`:

- `src/app/cart/CartClient.tsx`
- `src/app/account/orders/OrdersClient.tsx`
- `src/app/order-confirmation/page.tsx`
- `src/services/supabaseService.ts`
- `src/services/xenditService.ts`
- `supabase/functions/create-order-contribution/index.ts`
- `supabase/functions/verify-xendit-payment/index.ts`
- `supabase/functions/xendit-webhook/index.ts`
- `supabase/migrations/20260620053357_harden_downpayment_flow.sql`
- `supabase/migrations/20260620065000_skip_downpayment_cart_clear.sql`
- `supabase/migrations/20260620073000_fix_split_order_cart_item_cast.sql`

## What Changed in the Storefront

### 1. Checkout / order creation

In `src/app/cart/CartClient.tsx`, the downpayment checkout path:

- creates the order through `createSplitOrderFromCart(...)`
- passes:
  - `isSplitOrder: true`
  - `splitMessage: 'downpayment_50'`
  - `splitCount: 2`
- then immediately creates a contribution invoice for `order.total_amount / 2`

The RPC behind that is `create_split_order_from_cart(...)` in SQL.

### 2. Server-side lead-time enforcement

The storefront no longer trusts the frontend alone for downpayment eligibility.

`create_split_order_from_cart(...)` now blocks `downpayment_50` orders when:

- `p_delivery_date < Manila today + 3 days`

This means the admin dashboard should understand that downpayment orders are intentionally restricted and validated server-side.

### 3. Customer order page behavior

In `src/app/account/orders/OrdersClient.tsx`:

- a customer sees `Pay Remaining Balance` only when:
  - `payment_status === 'partial'`
  - `split_message === 'downpayment_50'`
- normal split-bill UI is intentionally filtered so `downpayment_50` does not look like the old share-with-friends flow

### 4. Confirmation page behavior

In `src/app/order-confirmation/page.tsx`:

- `partial` now means "Downpayment Received"
- the page calculates the real remaining balance from:
  - `total_amount - amount_collected`
- the page explicitly tells the customer:
  - the remaining balance must be paid before delivery or pickup
  - delivery/release only proceeds after full payment is received
  - they can go to `My Orders` and tap `Pay Remaining Balance`

### 5. Contribution invoice creation rules

In `supabase/functions/create-order-contribution/index.ts`:

- the function verifies the caller
- for `downpayment_50` orders, only `organizer_user_id` can create invoices
- the first contribution must be the exact rounded 50% amount
- the second contribution must be the exact remaining balance
- repeated clicks reuse the existing pending invoice instead of creating duplicates

### 6. Payment verification / reconciliation

In `supabase/functions/verify-xendit-payment/index.ts` and `supabase/functions/xendit-webhook/index.ts`:

- contribution payments are checked against the expected stored contribution amount
- paid contributions update `order_contributions.status = 'paid'`
- total paid contributions are summed into `cakegenie_orders.amount_collected`
- state transitions become:
  - enough for 50% => `payment_status = 'partial'`, `order_status = 'confirmed'`
  - enough for 100% => `payment_status = 'paid'`, `order_status = 'confirmed'`

### 7. Trigger / database state machine

`handle_order_contribution_update()` was hardened so that:

- it locks the order row
- recomputes total paid contributions
- sets:
  - `amount_collected`
  - `payment_status`
  - `order_status`
- treats `downpayment_50` specially at the 50% threshold

### 8. Cart clearing nuance

`clear_cart_for_paid_order(...)` was updated so that:

- it accepts both `paid` and `partial`
- but for `downpayment_50` orders it now returns `0` and does **not** wipe the cart after payment

This exists to avoid deleting unrelated new cart items after a customer already created the order.

### 9. Important regression already fixed

There was a follow-up fix in `20260620073000_fix_split_order_cart_item_cast.sql` because `create_split_order_from_cart(...)` still accepts `p_cart_item_ids text[]`, so `cakegenie_cart.cart_item_id` comparisons must remain:

- `cart.cart_item_id::text = any(p_cart_item_ids)`
- `cart_item_id::text = any(p_cart_item_ids)`

That fix is already live.

## Database Concepts the Dashboard Must Respect

### `cakegenie_orders`

The dashboard should treat these fields as first-class for downpayment orders:

- `is_split_order`
- `split_message`
- `split_count`
- `amount_collected`
- `organizer_user_id`
- `total_amount`
- `payment_status`
- `order_status`

Derived values you should compute in the dashboard:

- `remaining_balance = total_amount - amount_collected`
- `is_downpayment_order = is_split_order && split_message === 'downpayment_50'`
- `is_partially_paid_downpayment = is_downpayment_order && payment_status === 'partial'`

### `order_contributions`

This table now matters for operations visibility. Relevant fields:

- `contribution_id`
- `order_id`
- `user_id`
- `contributor_name`
- `contributor_email`
- `amount`
- `status`
- `paid_at`
- `payment_url`
- `xendit_invoice_id`

There are also unique indexes on:

- `xendit_payment_request_id`
- `xendit_invoice_id`

## Admin Dashboard Files That Likely Need Changes

Review these files in `/Users/apcaballes/genie.ph-admin-dashboard`:

- `types.ts`
- `services/supabase.ts`
- `pages/OrdersPage.tsx`
- `components/ui/Badge.tsx`

Based on the current code, the dashboard already knows about `payment_status = 'partial'`, but it does **not** appear to fully model the downpayment flow.

## Required Dashboard Adjustments

Implement the following:

### A. Extend the `Order` type

In `types.ts`, make sure the dashboard order model includes at least:

- `is_split_order`
- `split_message`
- `split_count`
- `amount_collected`
- `organizer_user_id`

If useful, add derived helper fields client-side:

- `remaining_balance`
- `is_downpayment_order`

### B. Improve the order details view

In `pages/OrdersPage.tsx`, for downpayment orders show:

- a clear `Downpayment 50%` or `Deposit Order` badge
- `Total Amount`
- `Amount Collected`
- `Remaining Balance`
- whether the order is:
  - `Partial / waiting for final payment`
  - `Fully paid`

Do not let `order_status = confirmed` mislead staff into thinking the order is fully paid.

### C. Add operational warning for partially paid downpayment orders

When:

- `split_message === 'downpayment_50'`
- `payment_status === 'partial'`

show an explicit warning similar to:

- `This order is only partially paid. Delivery or release should not proceed until the remaining balance is paid.`

### D. Show contribution history

Extend the order detail query so the dashboard can inspect `order_contributions` for the order.

The dashboard should ideally show:

- each contribution row
- amount
- contributor
- status
- paid timestamp
- whether the first payment was the 50% deposit vs the remaining balance

This is important because the truth source for the payment progression is now distributed between:

- `cakegenie_orders`
- `order_contributions`
- Xendit-linked contribution invoice ids

### E. Add better list/filter behavior

In `services/supabase.ts` and `pages/OrdersPage.tsx`, add or improve:

- filtering for `payment_status = 'partial'`
- optional filtering for `split_message = 'downpayment_50'`
- list badges so staff can identify deposit orders from the main orders table without opening each one

### F. Review analytics / totals logic

Audit any dashboard metrics that assume:

- `paid` is the only meaningful funded state
- or `total_amount` alone reflects cash already received

For downpayment orders, consider whether the dashboard should expose:

- count of partially paid orders
- sum of outstanding balances
- sum of collected deposit amounts

Do not silently treat `partial` orders as fully paid revenue unless that is an intentional business decision.

### G. Fix risky manual payment-status editing

Important: the current admin dashboard appears to allow directly updating `cakegenie_orders.payment_status`.

That is now dangerous for `downpayment_50` orders, because changing `payment_status` manually can desynchronize:

- `payment_status`
- `amount_collected`
- `order_contributions`

Please audit the dashboard's manual payment update flow and choose one of these safer approaches:

1. Make `payment_status` read-only for downpayment orders.
2. Add a dedicated admin action for recording the final balance payment properly.
3. If manual overrides are allowed, require the override flow to also reconcile `amount_collected` and the contribution history.

Do not leave a path where staff can flip `partial -> paid` on the order row alone.

## Suggested Acceptance Criteria

Your dashboard update is complete only when:

1. A `downpayment_50` order is visually distinct from a normal order and from a generic split-with-friends order.
2. Staff can see `total_amount`, `amount_collected`, and `remaining_balance`.
3. Staff can clearly tell that `confirmed + partial` means "booking confirmed but not fully paid."
4. Staff are warned not to release/deliver partially paid downpayment orders.
5. Staff can inspect contribution/payment history for the order.
6. Dashboard filters and badges support `partial` downpayment orders cleanly.
7. Manual payment status updates no longer create state drift for deposit orders.

## Deliverables

Please produce:

1. A short implementation plan for the admin dashboard changes.
2. The actual code changes in the dashboard repo.
3. A brief QA checklist covering:
   - fully paid normal orders
   - `downpayment_50` orders at `partial`
   - `downpayment_50` orders after full balance payment
   - any manual payment override path

Do not give me a generic summary. Inspect the named storefront files and map the admin dashboard changes directly to this implementation.

---
