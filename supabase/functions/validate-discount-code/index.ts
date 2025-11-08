// supabase/functions/validate-discount-code/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Define corsHeaders directly instead of importing
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Add a declaration for the Deno global object
declare const Deno: any;

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Log the start of the function
    console.log('validate-discount-code function started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase environment variables');
      throw new Error('Supabase environment variables are not set.');
    }

    // Create a Supabase client with the service role key to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    
    // Get the user from the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      throw new Error('Missing authorization header');
    }
    
    const jwt = authHeader.replace('Bearer ', '');
    console.log('Authenticating user with JWT...');
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError) {
      console.error('Authentication error:', userError.message);
      throw new Error(`Authentication error: ${userError.message}`);
    }
    if (!user) {
      console.error('User not found');
      throw new Error('User not found');
    }
    
    console.log('User authenticated:', user.id);

    // Get request body
    const { code, orderAmount } = await req.json();
    console.log('Received request:', { code, orderAmount });
    
    if (!code || orderAmount === undefined) {
      console.error('Missing code or orderAmount');
      return new Response(JSON.stringify({ valid: false, error: 'Missing code or orderAmount' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Fetch the discount code from the database
    console.log('Fetching discount code:', code.toUpperCase());
    const { data: discountCode, error: dbError } = await supabaseAdmin
      .from('discount_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (dbError || !discountCode) {
      console.error('Discount code not found:', dbError?.message || 'Code not found');
      return new Response(JSON.stringify({ valid: false, error: 'Invalid discount code' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 with valid:false for client-side handling
      });
    }

    console.log('Found discount code:', discountCode.code);
    
    // --- Start Validation Checks ---
    
    // Debug logging for expiration check
    console.log('Debug expiration check:', {
      code: discountCode.code,
      expires_at: discountCode.expires_at,
      expires_at_date: discountCode.expires_at ? new Date(discountCode.expires_at) : null,
      current_time: new Date(),
      is_expired: discountCode.expires_at && new Date(discountCode.expires_at) < new Date()
    });

    if (!discountCode.is_active) {
      console.log('Discount code is not active');
      return new Response(JSON.stringify({ valid: false, error: 'This discount code is not active.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

    // Check expiration only if expires_at is set
    if (discountCode.expires_at) {
      const expirationDate = new Date(discountCode.expires_at);
      const now = new Date();
      
      // Additional debug info for timezone comparison
      console.log('Detailed time comparison:', {
        expiration_timestamp: expirationDate.getTime(),
        current_timestamp: now.getTime(),
        expiration_utc_string: expirationDate.toUTCString(),
        current_utc_string: now.toUTCString(),
        timezone_offset: now.getTimezoneOffset()
      });
      
      if (expirationDate < now) {
        console.log('Discount code has expired');
        return new Response(JSON.stringify({ 
          valid: false, 
          error: `This discount code expired on ${expirationDate.toLocaleDateString()}.` 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200
        });
      }
    }

    if (discountCode.times_used >= discountCode.max_uses) {
      console.log('Discount code has reached usage limit');
      return new Response(JSON.stringify({ valid: false, error: 'This discount code has reached its usage limit.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

    if (discountCode.min_order_amount && orderAmount < discountCode.min_order_amount) {
      console.log('Order amount is below minimum required');
      return new Response(JSON.stringify({ valid: false, error: `Minimum order amount of ₱${discountCode.min_order_amount} is required.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

    // Check if the code is user-specific
    if (discountCode.user_id && discountCode.user_id !== user.id) {
      console.log('Discount code is not valid for this user');
      return new Response(JSON.stringify({ valid: false, error: 'This code is not valid for your account.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }
    
    // --- All Checks Passed ---
    console.log('All validation checks passed');

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

    console.log('Returning success response:', responsePayload);
    
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