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
        const { image, mimeType } = await req.json();

        if (!image || !mimeType) {
            throw new Error("Missing image or mimeType");
        }

        console.log('📥 Edge Function request received (Modal segmentation only)');
        console.log('🔍 Image size:', image.length, 'bytes');
        console.log('🔍 MIME type:', mimeType);

        // Call Modal for segmentation - use everything_prompt
        // FastSAM's text-based prompting is not accurate for cake components
        // We'll filter/label masks on frontend based on Gemini's analysis
        const modalEndpoint = "https://apcaballes--fastsam-segmentation-segment.modal.run";
        const prompts = ["everything_prompt"];

        console.log("🚀 Starting Modal Segmentation (Everything Mode)...");

        const modalResponse = await fetch(modalEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                image: image,  // ✅ Correct parameter name for Modal
                prompts: prompts
            })
        });

        if (!modalResponse.ok) {
            throw new Error(`Modal API error: ${modalResponse.status} ${modalResponse.statusText}`);
        }

        const segmentationData = await modalResponse.json();
        console.log("✅ Modal response received");
        console.log("📊 Modal response:", JSON.stringify(segmentationData).substring(0, 500));

        // Return segmentation data directly
        if (segmentationData && segmentationData.predictions && segmentationData.predictions.length > 0) {
            const prediction = segmentationData.predictions[0];
            console.log("🎭 Prediction keys:", Object.keys(prediction));
            console.log("🎭 Masks found:", prediction.masks?.length || 0);
            console.log("🏷️ Labels found:", prediction.labels?.length || 0);
            console.log("📈 Scores found:", prediction.scores?.length || 0);

            // Format as expected by frontend
            const items = [];
            const masksArray = prediction.masks || [];
            const labelsArray = prediction.labels || [];
            const scoresArray = prediction.scores || [];

            console.log("🔄 Processing masks...");
            for (let i = 0; i < masksArray.length; i++) {
                const mask = masksArray[i];
                const label = labelsArray[i] || `object_${i}`;
                const confidence = scoresArray[i] || 1.0;

                // Skip null masks
                if (mask === null || mask === undefined) {
                    console.log(`⚠️ Skipping null mask at index ${i}`);
                    continue;
                }

                items.push({
                    mask: mask,
                    label: label,
                    confidence: confidence
                });
            }

            const formattedSegmentation = {
                model_type: "fastsam",
                model_version: "fastsam-x",
                items: items
            };

            console.log("✅ Formatted", items.length, "segmentation items");
            console.log("📦 Sample item keys:", items.length > 0 ? Object.keys(items[0]) : "none");

            return new Response(JSON.stringify(formattedSegmentation), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } else {
            console.warn("⚠️ No valid segmentation predictions found.");
            console.warn("📊 Segmentation data:", JSON.stringify(segmentationData));
            return new Response(JSON.stringify({
                model_type: "fastsam",
                model_version: "fastsam-x",
                items: []
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }


    } catch (error) {
        console.error("🔥 CRITICAL ERROR:", error);
        console.error("🔥 Error name:", error?.name);
        console.error("🔥 Error message:", error?.message);
        console.error("🔥 Error stack:", error?.stack);

        return new Response(JSON.stringify({
            error: error?.message || "Unknown error",
            errorName: error?.name,
            errorStack: error?.stack,
            _debug: {
                error: error?.message,
                stack: error?.stack,
                name: error?.name,
                timestamp: new Date().toISOString()
            }
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
