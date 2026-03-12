import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigate() {
    console.log('Investigating remaining 13 records...');
    const { data: records, error } = await supabase
        .from('cakegenie_analysis_cache')
        .select('p_hash, original_image_url')
        .is('image_embedding', null)
        .not('original_image_url', 'is', null)
        .limit(20);

    if (error) {
        console.error('Error fetching records:', error);
        return;
    }

    console.log(`\nDetailed Error Analysis for ${records?.length} records:\n`);

    for (const record of records || []) {
        try {
            const res = await fetch(record.original_image_url);
            console.log(`p_hash: ${record.p_hash}`);
            console.log(`URL: ${record.original_image_url}`);
            console.log(`HTTP Status: ${res.status} ${res.statusText}`);
            
            const contentType = res.headers.get('content-type');
            const contentLength = res.headers.get('content-length');
            console.log(`Content-Type: ${contentType}`);
            console.log(`Content-Length: ${contentLength}`);

            if (!res.ok) {
                console.log(`Result: ❌ FAILED FETCH (HTTP ${res.status})`);
            } else {
                const buffer = await res.arrayBuffer();
                if (buffer.byteLength === 0) {
                    console.log(`Result: ❌ EMPTY BUFFER (0 bytes)`);
                } else {
                    console.log(`Result: ⚠️ VALID DOWNLOAD BUT PREVIOUS SCRIPT FAILED (Check Sharp/Gemini logs)`);
                }
            }
        } catch (e) {
            console.log(`p_hash: ${record.p_hash}`);
            console.log(`URL: ${record.original_image_url}`);
            console.log(`Result: ❌ NETWORK ERROR: ${e instanceof Error ? e.message : e}`);
        }
        console.log('---');
    }
}

investigate();
