import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log('✅ Test Edge Function called');
        const body = await req.json();
        console.log('📦 Received body keys:', Object.keys(body));

        return new Response(JSON.stringify({
            success: true,
            message: "Test successful",
            receivedKeys: Object.keys(body)
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("❌ Test error:", error);
        return new Response(JSON.stringify({
            error: error?.message || String(error),
            stack: error?.stack
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
})
