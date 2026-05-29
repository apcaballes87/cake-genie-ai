/**
 * One-off: generate a correctly-sized header logo and upload it to Supabase
 * storage as a NEW object (does not overwrite the 700x171 original).
 *
 * The header logo is displayed at most 164x40 CSS px, so a 360px-wide asset
 * covers 2x retina while cutting transfer bytes ~80%. Lighthouse flagged the
 * 700x171 original as oversized for its 287x70 rendered box.
 *
 * Run: node scripts/resize-logo.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const BUCKET = 'landingpage';
const SOURCE_PATH = 'genie-logo-header.webp';
const DEST_PATH = 'genie-logo-header-360.webp';
const TARGET_WIDTH = 360;

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
    // Download the original from public storage.
    const sourceUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${SOURCE_PATH}`;
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`Failed to download source logo: HTTP ${res.status}`);
    const inputBuf = Buffer.from(await res.arrayBuffer());

    const meta = await sharp(inputBuf).metadata();
    console.log(`Source: ${meta.width}x${meta.height} ${meta.format} (${inputBuf.length} bytes)`);

    const outputBuf = await sharp(inputBuf)
        .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
        .webp({ quality: 90, alphaQuality: 100 })
        .toBuffer();

    const outMeta = await sharp(outputBuf).metadata();
    console.log(`Resized: ${outMeta.width}x${outMeta.height} (${outputBuf.length} bytes)`);

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(DEST_PATH, outputBuf, {
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000, immutable',
            upsert: true,
        });

    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(DEST_PATH);
    console.log(`Uploaded: ${data.publicUrl}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
