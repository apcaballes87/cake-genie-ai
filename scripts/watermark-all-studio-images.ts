import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Configuration error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const LOGO_URL = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/new%20genie%20logo%20long.webp';
const PROGRESS_FILE = path.resolve(process.cwd(), 'scratch/watermarked-progress.json');

// Parse CLI arguments
const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const dryRun = args.includes('--dry-run');
const resetProgress = args.includes('--reset-progress');

// Helper to delay execution
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Helper to download an image as a Buffer
async function downloadImage(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

// Extract bucket and path from Supabase storage URL
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
    const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!match) return null;
    return {
        bucket: decodeURIComponent(match[1]),
        path: decodeURIComponent(match[2]),
    };
}

// Load progress tracker
function loadProgress(): Set<string> {
    if (resetProgress) {
        console.log('🔄 Resetting progress tracker as requested.');
        return new Set();
    }
    if (fs.existsSync(PROGRESS_FILE)) {
        try {
            const content = fs.readFileSync(PROGRESS_FILE, 'utf8');
            const data = JSON.parse(content);
            if (Array.isArray(data.processedHashes)) {
                return new Set(data.processedHashes);
            }
        } catch (err) {
            console.warn('⚠️ Warning: Could not read progress file. Starting fresh.', (err as Error).message);
        }
    }
    return new Set();
}

// Save progress tracker
function saveProgress(processedHashes: Set<string>) {
    const dir = path.dirname(PROGRESS_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
        PROGRESS_FILE,
        JSON.stringify({ processedHashes: Array.from(processedHashes) }, null, 2),
        'utf8'
    );
}

async function main() {
    console.log('🎂 Genie.ph — Studio Image Watermark Backfill');
    console.log(`    DRY_RUN=${dryRun}  LIMIT=${limit ?? 'unlimited'}  RESET_PROGRESS=${resetProgress}`);
    console.log('─────────────────────────────────────────────────────────────────');

    const processedHashes = loadProgress();
    console.log(`ℹ️ Already processed: ${processedHashes.size} images.`);

    // 1. Fetch the logo
    console.log('📥 Downloading Genie logo watermark...');
    let logoBuffer: Buffer;
    try {
        logoBuffer = await downloadImage(LOGO_URL);
    } catch (err) {
        console.error('❌ Failed to download watermark logo:', (err as Error).message);
        process.exit(1);
    }

    // 2. Fetch all completed studio edit rows
    console.log('🔍 Fetching completed studio edited rows from database...');
    
    let allRows: { p_hash: string; slug: string | null; studio_edited_image_url: string | null }[] = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('cakegenie_analysis_cache')
            .select('p_hash, slug, studio_edited_image_url')
            .eq('studio_edit_status', 'completed')
            .not('studio_edited_image_url', 'is', null)
            .neq('studio_edited_image_url', '')
            .order('created_at', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('❌ Supabase fetch error:', error.message);
            process.exit(1);
        }

        if (!data || data.length === 0) {
            break;
        }

        allRows = allRows.concat(data);
        if (data.length < pageSize) {
            break;
        }
        page++;
    }

    // Filter out rows that are already processed or don't have http URL
    const eligibleRows = allRows.filter(row => 
        !processedHashes.has(row.p_hash) && 
        row.studio_edited_image_url && 
        row.studio_edited_image_url.startsWith('http')
    );

    console.log(`📊 Found ${allRows.length} total completed studio rows.`);
    console.log(`📊 Eligible for processing (not watermarked yet): ${eligibleRows.size ?? eligibleRows.length}`);

    if (eligibleRows.length === 0) {
        console.log('🎉 All completed studio images are already watermarked!');
        process.exit(0);
    }

    const rowsToProcess = limit ? eligibleRows.slice(0, limit) : eligibleRows;
    console.log(`🚀 Processing ${rowsToProcess.length} images...`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < rowsToProcess.length; i++) {
        const row = rowsToProcess[i];
        const indexStr = `[${i + 1}/${rowsToProcess.length}]`;
        console.log(`${indexStr} Processing p_hash=${row.p_hash} (slug=${row.slug})`);

        try {
            // 解析 URL
            const storageInfo = parseStorageUrl(row.studio_edited_image_url!);
            if (!storageInfo) {
                throw new Error(`Invalid storage URL: ${row.studio_edited_image_url}`);
            }

            if (dryRun) {
                console.log(`  [DRY] Would download ${row.studio_edited_image_url}`);
                console.log(`  [DRY] Would apply watermark and upload back to bucket: ${storageInfo.bucket}, path: ${storageInfo.path}`);
                console.log(`  [DRY] Would update database row to trigger variant pipeline`);
                processedHashes.add(row.p_hash);
                successCount++;
                continue;
            }

            // 1. Download current studio image
            const imageBuffer = await downloadImage(row.studio_edited_image_url!);

            // 2. Get dimensions
            const imageSharp = sharp(imageBuffer);
            const meta = await imageSharp.metadata();
            if (!meta.width || !meta.height) {
                throw new Error('Failed to read image dimensions');
            }

            // 3. Resize logo and apply 50% opacity
            const targetLogoWidth = Math.round(meta.width / 3);
            const logoResized = await sharp(logoBuffer)
                .resize({ width: targetLogoWidth })
                .ensureAlpha()
                .linear([1, 1, 1, 0.5], [0, 0, 0, 0])
                .png()
                .toBuffer();

            const padding = Math.round(meta.width * 0.03);
            const top = padding;
            const left = meta.width - targetLogoWidth - padding;

            // 4. Composite
            const watermarkedBuffer = await imageSharp
                .composite([
                    {
                        input: logoResized,
                        top,
                        left,
                    }
                ])
                .webp({ quality: 92, effort: 4 })
                .toBuffer();

            // 5. Upload back to Supabase bucket (overwrites current studio edited image)
            const { error: uploadError } = await supabase.storage
                .from(storageInfo.bucket)
                .upload(storageInfo.path, watermarkedBuffer, {
                    contentType: 'image/webp',
                    upsert: true,
                });

            if (uploadError) {
                throw new Error(`Supabase upload error: ${uploadError.message}`);
            }

            // 6. Update database row to clear image variants, triggering regeneration webhook
            const { error: dbError } = await supabase
                .from('cakegenie_analysis_cache')
                .update({
                    image_variants: null,
                    image_variants_indexed_source: null,
                    image_variants_status: 'pending',
                    image_variants_error: null,
                })
                .eq('p_hash', row.p_hash);

            if (dbError) {
                throw new Error(`Database update error: ${dbError.message}`);
            }

            processedHashes.add(row.p_hash);
            saveProgress(processedHashes);
            successCount++;
            console.log(`  ✅ Done! Watermark applied and variant webhook triggered.`);

            // Sleep 250ms between rows to stagger webhook invocations on Vercel
            await sleep(250);

        } catch (err) {
            failCount++;
            console.error(`  ❌ Error processing row ${row.p_hash}:`, (err as Error).message);
        }
    }

    console.log('─────────────────────────────────────────────────────────────────');
    console.log(`🏁 Run complete. Success: ${successCount}, Failed: ${failCount}`);
    console.log(`ℹ️ Progress saved. Total processed so far: ${processedHashes.size}`);
}

main().catch((err) => {
    console.error('💥 Unhandled script error:', err);
    process.exit(1);
});
