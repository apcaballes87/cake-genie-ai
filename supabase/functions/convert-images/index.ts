
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';

Deno.serve(async (req) => {
    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const BUCKET_NAME = 'landingpage';
        console.log(`Connecting to bucket: ${BUCKET_NAME}`);

        // 1. List files
        const { data: files, error: listError } = await supabase.storage
            .from(BUCKET_NAME)
            .list();

        if (listError) throw listError;
        if (!files || files.length === 0) {
            return new Response(JSON.stringify({ message: "No files found" }), { headers: { 'Content-Type': 'application/json' } });
        }

        const jpgFiles = files.filter(f => f.name.toLowerCase().endsWith('.jpg') || f.name.toLowerCase().endsWith('.jpeg'));
        const results = [];

        console.log(`Found ${jpgFiles.length} JPG files.`);

        for (const file of jpgFiles) {
            const fileName = file.name;
            const newFileName = fileName.replace(/\.(jpg|jpeg)$/i, '.webp');

            // Check if exists
            const { data: existing } = await supabase.storage.from(BUCKET_NAME).list('', { search: newFileName });
            if (existing && existing.length > 0) {
                results.push({ file: fileName, status: 'skipped', reason: 'webp already exists' });
                continue;
            }

            console.log(`Processing ${fileName}...`);

            // Download
            const { data: fileData, error: downloadError } = await supabase.storage
                .from(BUCKET_NAME)
                .download(fileName);

            if (downloadError) {
                results.push({ file: fileName, status: 'error', error: downloadError.message });
                continue;
            }

            // Convert
            const buffer = await fileData.arrayBuffer();
            const image = await Image.decode(buffer);
            const webpBuffer = await image.encode(2); // Level 2 compression (lossy, balanced)

            // Upload
            const { error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(newFileName, webpBuffer, {
                    contentType: 'image/webp',
                    upsert: true
                });

            if (uploadError) {
                results.push({ file: fileName, status: 'error', error: uploadError.message });
            } else {
                results.push({ file: fileName, status: 'success', newFile: newFileName });
            }
        }

        return new Response(JSON.stringify({ results }), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
