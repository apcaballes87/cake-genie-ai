import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load .env and .env.local
if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
}
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Supabase URL and Anon Key are required. Please check your .env or .env.local files.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl!, supabaseKey!);

const INDEXNOW_KEY = 'eb07198642754c03b8e0e7d58d867c48';
const HOST = 'genie.ph';

// Import blog posts to get slugs
// Note: We're using a dynamic import or relative path since this is a script
const getBlogSlugs = () => {
    try {
        const blogContent = fs.readFileSync(path.join(process.cwd(), 'src/data/blogPosts.ts'), 'utf8');
        const slugMatches = blogContent.match(/slug:\s*['"]([^'"]+)['"]/g);
        if (slugMatches) {
            return slugMatches.map(m => m.match(/['"]([^'"]+)['"]/)![1]);
        }
    } catch (err) {
        console.warn('Could not read blog posts file, skipping blog URLs.');
    }
    return [];
};

async function bulkSubmit() {
    console.log('--- IndexNow Bulk Submission ---');
    console.log(`Host: ${HOST}`);

    const urls: string[] = [
        `https://${HOST}/`,
        `https://${HOST}/shop`,
        `https://${HOST}/blog`,
        `https://${HOST}/customizing`,
        `https://${HOST}/cake-price-calculator`,
        `https://${HOST}/about`,
        `https://${HOST}/contact`,
        `https://${HOST}/faq`,
    ];

    // 1. Fetch all cached designs
    console.log('Fetching cached designs...');
    try {
        const { data: designs, error } = await supabase
            .from('cakegenie_analysis_cache')
            .select('slug')
            .not('slug', 'is', null)
            .limit(2000);

        if (error) throw error;

        if (designs) {
            designs.forEach(d => urls.push(`https://${HOST}/customizing/${d.slug}`));
            console.log(`- Added ${designs.length} cached designs`);
        }
    } catch (err) {
        console.error('Error fetching designs:', err);
    }

    // 2. Fetch all shared designs
    console.log('Fetching shared designs...');
    try {
        const { data: shared, error } = await supabase
            .from('cakegenie_shared_designs')
            .select('url_slug')
            .not('url_slug', 'is', null)
            .limit(1000);

        if (error) throw error;

        if (shared) {
            shared.forEach(s => urls.push(`https://${HOST}/customizing/${s.url_slug}`));
            console.log(`- Added ${shared.length} shared designs`);
        }
    } catch (err) {
        console.error('Error fetching shared designs:', err);
    }

    // 3. Add blog post URLs
    console.log('Adding blog post URLs...');
    const blogSlugs = getBlogSlugs();
    blogSlugs.forEach(slug => urls.push(`https://${HOST}/blog/${slug}`));
    console.log(`- Added ${blogSlugs.length} blog posts`);

    // Deduplicate and filter any invalid URLs
    const uniqueUrls = Array.from(new Set(urls.filter(u => u.startsWith('https://'))));
    console.log(`Submitting ${uniqueUrls.length} unique URLs to IndexNow...`);

    try {
        const response = await fetch('https://www.bing.com/indexnow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
                host: HOST,
                key: INDEXNOW_KEY,
                keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
                urlList: uniqueUrls,
            }),
        });

        if (response.ok) {
            console.log('Submission successful:', response.status);
        } else {
            const text = await response.text();
            console.log('Submission status (might be pending verification):', response.status, text);
        }
    } catch (error: any) {
        console.error('Submission failed:', error.message);
    }
}

bulkSubmit();
