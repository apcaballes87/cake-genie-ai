import { HybridAnalysisResult } from '../types';
import { getSupabaseClient } from '../lib/supabase/client';

/**
 * Call Supabase Edge Function for Modal segmentation ONLY
 * The Edge Function calls Modal.com and returns just the segmentation data
 * @param imageBase64 Base64 encoded image (without data URI prefix)
 * @param mimeType Image MIME type (e.g., 'image/jpeg')
 * @returns Promise with segmentation data or null
 */
export async function getModalSegmentation(
    imageBase64: string,
    mimeType: string
): Promise<any | null> {
    const supabase = getSupabaseClient();

    console.log('📡 Calling analyze-cake-v2 Edge Function for Modal segmentation...');

    // Call the edge function - it will ONLY run Modal
    const { data, error } = await supabase.functions.invoke('analyze-cake-v2', {
        body: {
            image: imageBase64,
            mimeType: mimeType
        }
    });

    if (error) {
        console.error('Edge Function Error:', error);
        console.error('Edge Function Error Details:', JSON.stringify(error, null, 2));
        throw new Error(`Modal segmentation failed: ${error.message}`);
    }

    if (!data) {
        console.warn('⚠️ No data returned from Edge Function');
        return null;
    }

    console.log('✅ Edge Function response received');
    console.log('📦 Response data keys:', Object.keys(data));

    // Log error details if present in response
    if (data.error || data._debug) {
        console.error('❌ Edge Function returned error in data:');
        console.error('Error:', data.error);
        console.error('Error Name:', data.errorName);
        console.error('Error Stack:', data.errorStack);
        console.error('Debug:', data._debug);
        throw new Error(`Edge Function error: ${data.error || 'Unknown error'}`);
    }

    // The Edge Function returns just the segmentation data
    return data;
}
