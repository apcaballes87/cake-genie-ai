import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Configuration error: NEXT_PUBLIC_SUPABASE_URL and a Supabase key must be set.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const LOGO_URL = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/new%20genie%20logo%20long.webp';
const OUTPUT_DIR = path.resolve(process.cwd(), 'public');
const OUTPUT_PATH = path.resolve(OUTPUT_DIR, 'test-watermarked-image.webp');

async function downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download image from ${url}: HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

async function main() {
    console.log('🎂 Watermark Tool — Starting test...');

    // 1. Get a sample row from Supabase with studio_edited_image_url
    console.log('🔍 Querying database for a sample cake design with a studio edited image...');
    const { data: rows, error } = await supabase
        .from('cakegenie_analysis_cache')
        .select('p_hash, slug, studio_edited_image_url')
        .not('studio_edited_image_url', 'is', null)
        .neq('studio_edited_image_url', '')
        .limit(5); // Fetch a few in case some URLs are invalid or slow

    if (error) {
        console.error('❌ Supabase query error:', error.message);
        process.exit(1);
    }

    if (!rows || rows.length === 0) {
        console.error('❌ No rows found with a non-empty studio_edited_image_url.');
        process.exit(1);
    }

    // Find the first row that actually has a valid http/https URL
    let selectedRow = null;
    for (const row of rows) {
        if (row.studio_edited_image_url && row.studio_edited_image_url.startsWith('http')) {
            selectedRow = row;
            break;
        }
    }

    if (!selectedRow) {
        console.error('❌ No valid http/https studio_edited_image_url found in the queried rows.');
        console.log('Queried rows:', rows);
        process.exit(1);
    }

    console.log(`✅ Selected cake design row:`);
    console.log(`   - p_hash: ${selectedRow.p_hash}`);
    console.log(`   - slug: ${selectedRow.slug}`);
    console.log(`   - studio_edited_image_url: ${selectedRow.studio_edited_image_url}`);

    // 2. Download the studio edited image and the logo
    console.log(`📥 Downloading studio edited image...`);
    const studioBuffer = await downloadImage(selectedRow.studio_edited_image_url);
    console.log(`📥 Downloading Genie logo...`);
    const logoBuffer = await downloadImage(LOGO_URL);

    // 3. Process the images using sharp
    console.log('⚙️ Processing watermark overlay...');
    const studioSharp = sharp(studioBuffer);
    const studioMeta = await studioSharp.metadata();

    if (!studioMeta.width || !studioMeta.height) {
        throw new Error('Could not retrieve studio image dimensions.');
    }

    console.log(`   - Studio Image dimensions: ${studioMeta.width}x${studioMeta.height}`);

    // Target logo width is 1/3 of the main image width
    const targetLogoWidth = Math.round(studioMeta.width / 3);
    console.log(`   - Target Logo width: ${targetLogoWidth}px`);

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Process the logo: resize, ensure alpha channel, and apply 50% opacity (alpha * 0.5)
    // We use a linear transformation: multiplier of 1 for RGB channels, 0.5 for Alpha.
    const logoResizedBuffer = await sharp(logoBuffer)
        .resize({ width: targetLogoWidth })
        .ensureAlpha()
        .linear([1, 1, 1, 0.5], [0, 0, 0, 0])
        .png()
        .toBuffer();

    const logoResizedMeta = await sharp(logoResizedBuffer).metadata();
    const logoHeight = logoResizedMeta.height || 0;
    console.log(`   - Resized Logo height: ${logoHeight}px`);

    // Position the logo in the top-right corner with 3% padding
    const padding = Math.round(studioMeta.width * 0.03);
    const top = padding;
    const left = studioMeta.width - targetLogoWidth - padding;

    console.log(`   - Positioning logo at top-right (top: ${top}px, left: ${left}px, padding: ${padding}px)`);

    // Composite the logo onto the studio image and save as WebP
    await sharp(studioBuffer)
        .composite([
            {
                input: logoResizedBuffer,
                top: top,
                left: left,
            }
        ])
        .webp({ quality: 90 })
        .toFile(OUTPUT_PATH);

    console.log(`🎉 Success! Watermarked image saved to:`);
    console.log(`   🔗 Local file: ${OUTPUT_PATH}`);
    console.log(`   🔗 Web URL (if server is running on port 3002): http://localhost:3002/test-watermarked-image.webp`);
}

main().catch((err) => {
    console.error('💥 Unhandled error:', err);
    process.exit(1);
});
