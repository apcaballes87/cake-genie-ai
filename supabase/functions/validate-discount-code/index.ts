// supabase/functions/validate-discount-code/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Add a declaration for the Deno global object
declare const Deno: any;

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase environment variables are not set.');
    }

    // Create a Supabase client with the service role key to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    
    // Get the user from the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError) {
      throw new Error(`Authentication error: ${userError.message}`);
    }
    if (!user) {
      throw new Error('User not found');
    }

    // Get request body
    const { code, orderAmount } = await req.json();
    if (!code || orderAmount === undefined) {
      return new Response(JSON.stringify({ valid: false, error: 'Missing code or orderAmount' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Fetch the discount code from the database
    const { data: discountCode, error: dbError } = await supabaseAdmin
      .from('discount_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (dbError || !discountCode) {
      return new Response(JSON.stringify({ valid: false, error: 'Invalid discount code' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 with valid:false for client-side handling
      });
    }

    // --- Start Validation Checks ---

    if (!discountCode.is_active) {
      return new Response(JSON.stringify({ valid: false, error: 'This discount code is not active.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

    if (new Date(discountCode.expires_at) < new Date()) {
      return new Response(JSON.stringify({ valid: false, error: 'This discount code has expired.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

    if (discountCode.times_used >= discountCode.max_uses) {
      return new Response(JSON.stringify({ valid: false, error: 'This discount code has reached its usage limit.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

    if (discountCode.min_order_amount && orderAmount < discountCode.min_order_amount) {
      return new Response(JSON.stringify({ valid: false, error: `Minimum order amount of ₱${discountCode.min_order_amount} is required.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

    // Check if the code is user-specific
    if (discountCode.user_id && discountCode.user_id !== user.id) {
       return new Response(JSON.stringify({ valid: false, error: 'This code is not valid for your account.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }
    
    // --- All Checks Passed ---

    let discountAmount = 0;
    if (discountCode.discount_amount) {
      discountAmount = discountCode.discount_amount;
    } else if (discountCode.discount_percentage) {
      discountAmount = orderAmount * (discountCode.discount_percentage / 100);
    }
    
    // Ensure discount doesn't exceed order amount
    discountAmount = Math.min(discountAmount, orderAmount);

    const finalAmount = orderAmount - discountAmount;

    const responsePayload = {
      valid: true,
      discountAmount: discountAmount,
      codeId: discountCode.code_id,
      originalAmount: orderAmount,
      finalAmount: finalAmount,
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in validate-discount-code function:', error.message);
    return new Response(JSON.stringify({ valid: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
