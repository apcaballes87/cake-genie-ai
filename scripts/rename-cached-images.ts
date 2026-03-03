import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = 'cakegenie';
const FOLDER_NAME = 'analysis-cache';
const SUPABASE_BASE_URL = 'https://cqmhanqnfybyxezhobkx.supabase.co';

async function renameImages() {
    console.log('Starting image renaming process...');

    let allRows: any[] = [];
    let start = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data: rows, error } = await supabase
            .from('cakegenie_analysis_cache')
            .select('p_hash, original_image_url, slug')
            .range(start, start + limit - 1);

        if (error) {
            console.error('Error fetching rows:', error);
            return;
        }

        if (rows && rows.length > 0) {
            allRows = allRows.concat(rows);
            start += limit;
        } else {
            hasMore = false;
        }
    }

    if (!allRows || allRows.length === 0) {
        console.log('No rows found in cakegenie_analysis_cache.');
        return;
    }

    console.log(`Found ${allRows.length} rows to process.`);

    for (const row of allRows) {
        const { p_hash, original_image_url, slug } = row;

        if (!slug) {
            console.log(`Skipping row ${p_hash}: No slug found.`);
            continue;
        }

        if (!original_image_url) {
            console.log(`Skipping row ${p_hash}: No image URL found.`);
            continue;
        }

        const targetFilename = `${slug}.jpg`;
        const targetPath = `${FOLDER_NAME}/${targetFilename}`;
        const targetUrl = `${SUPABASE_BASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${targetPath}`;

        // If already has the correct slug in the filename, skip
        if (original_image_url === targetUrl) {
            console.log(`Skipping row ${p_hash}: Already correctly named.`);
            continue;
        }

        console.log(`Processing row ${p_hash} (${slug})...`);

        try {
            let uploadSuccess = false;

            if (original_image_url.startsWith(SUPABASE_BASE_URL)) {
                // Renaming internal Supabase image
                // Extract the path after /public/cakegenie/
                const urlMatch = original_image_url.match(new RegExp(`/public/${BUCKET_NAME}/(.+)$`));
                if (urlMatch) {
                    const sourcePath = urlMatch[1];
                    console.log(`  Moving from ${sourcePath} to ${targetPath}...`);

                    // Supabase storage doesn't have a direct "move" that is reliable across different scenarios easily via client
                    // without potential conflicts. We'll use copy then update DB. 
                    // Actually, 'move' is more efficient.
                    const { error: moveError } = await supabase.storage
                        .from(BUCKET_NAME)
                        .move(sourcePath, targetPath);

                    if (moveError) {
                        if (moveError.message.includes('already exists')) {
                            console.log(`  Target already exists, just updating DB.`);
                            uploadSuccess = true;
                        } else {
                            console.error(`  Error moving file:`, moveError.message);
                        }
                    } else {
                        console.log(`  File moved successfully.`);
                        uploadSuccess = true;
                    }
                }
            } else {
                // External image - Download and Upload
                console.log(`  Downloading external image from ${original_image_url}...`);
                const response = await fetch(original_image_url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch image: ${response.statusText}`);
                }
                const buffer = await response.arrayBuffer();

                console.log(`  Uploading to ${targetPath}...`);
                const { error: uploadError } = await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(targetPath, buffer, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                if (uploadError) {
                    console.error(`  Error uploading file:`, uploadError.message);
                } else {
                    console.log(`  File uploaded successfully.`);
                    uploadSuccess = true;
                }
            }

            if (uploadSuccess) {
                // Update database
                const { error: updateError } = await supabase
                    .from('cakegenie_analysis_cache')
                    .update({ original_image_url: targetUrl })
                    .eq('p_hash', p_hash);

                if (updateError) {
                    console.error(`  Failed to update database for ${p_hash}:`, updateError.message);
                } else {
                    console.log(`  Database updated for ${p_hash} successfully.`);
                }
            }
        } catch (err: any) {
            console.error(`  Unexpected error processing row ${p_hash}:`, err.message);
        }
    }

    console.log('Renaming process complete.');
}

renameImages();
