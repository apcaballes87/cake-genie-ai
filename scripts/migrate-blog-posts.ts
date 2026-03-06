/**
 * Blog Migration Script
 * Run with: npx tsx scripts/migrate-blog-posts.ts
 * 
 * This script migrates all blog posts from src/data/blogPosts.ts to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { blogPosts, BlogPost } from '../src/data/blogPosts';

// Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing Supabase credentials in environment');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
}

// Create client with anon key - requires table to allow insert for anon role
const supabase = createClient(supabaseUrl, supabaseKey);

interface BlogInsert {
    slug: string;
    title: string;
    excerpt: string;
    content: string;
    date: string;
    author: string;
    author_url?: string;
    image?: string;
    keywords?: string;
    cake_search_keywords?: string;
    related_cakes_intro?: string;
    is_published: boolean;
}

async function migrateBlogs() {
    console.log(`Starting migration of ${blogPosts.length} blog posts...\n`);

    const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
    };

    for (const post of blogPosts) {
        try {
            const blogData: BlogInsert = {
                slug: post.slug,
                title: post.title,
                excerpt: post.excerpt,
                content: post.content,
                date: post.date,
                author: post.author,
                author_url: post.authorUrl,
                image: post.image,
                keywords: post.keywords,
                cake_search_keywords: post.cakeSearchKeywords,
                related_cakes_intro: post.relatedCakesIntro,
                is_published: true
            };

            const { error } = await supabase
                .from('blogs')
                .upsert(blogData, { onConflict: 'slug' });

            if (error) {
                throw error;
            }

            results.success++;
            console.log(`✓ Migrated: ${post.title}`);
        } catch (error: any) {
            results.failed++;
            results.errors.push(`Failed to migrate "${post.title}": ${error.message}`);
            console.error(`✗ Failed: ${post.title}`);
        }
    }

    console.log('\n--- Migration Summary ---');
    console.log(`Successful: ${results.success}`);
    console.log(`Failed: ${results.failed}`);

    if (results.errors.length > 0) {
        console.log('\nErrors:');
        results.errors.forEach(err => console.log(`  - ${err}`));
    }

    // Verify
    console.log('\n--- Verification ---');
    const { data: count } = await supabase
        .from('blogs')
        .select('*', { count: 'exact', head: true });
    console.log(`Total blogs in database: ${count?.length || 0}`);
}

migrateBlogs()
    .then(() => {
        console.log('\nMigration complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
