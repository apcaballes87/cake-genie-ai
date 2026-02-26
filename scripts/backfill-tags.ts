import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- Color Parsing Tools ---
const AVAILABLE_ICING_COLORS = [
    { name: 'black', keywords: ['black', 'dark'], hex: '#1A1A1A' },
    { name: 'white', keywords: ['white', 'light white', 'gray', 'grey', 'cream', 'silver'], hex: '#E2E8F0' },
    { name: 'blue', keywords: ['blue', 'cyan', 'sky', 'baby blue', 'teal', 'aqua', 'turquoise'], hex: '#60A5FA' },
    { name: 'red', keywords: ['red', 'maroon', 'crimson', 'scarlet'], hex: '#EF4444' },
    { name: 'purple', keywords: ['purple', 'violet', 'lavender', 'lilac', 'mauve'], hex: '#8B5CF6' },
    { name: 'green', keywords: ['green', 'mint', 'lime', 'emerald', 'sage', 'olive'], hex: '#22C55E' },
    { name: 'yellow', keywords: ['yellow', 'gold', 'lemon', 'canary'], hex: '#FACC15' },
    { name: 'orange', keywords: ['orange', 'tangerine', 'peach', 'coral', 'salmon'], hex: '#F97316' },
    { name: 'brown', keywords: ['brown', 'chocolate', 'tan', 'mocha', 'coffee', 'caramel'], hex: '#92400E' },
    { name: 'pink', keywords: ['pink', 'rose', 'magenta', 'fuchsia', 'blush'], hex: '#EC4899' },
];

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
};

const findClosestColorName = (color: string): string | null => {
    if (!color) return null;
    const colorLower = color.toLowerCase().trim();
    if (colorLower.startsWith('#')) {
        const inputRgb = hexToRgb(colorLower);
        if (inputRgb) {
            let closestColor = AVAILABLE_ICING_COLORS[0].name;
            let minDistance = Infinity;
            for (const colorOption of AVAILABLE_ICING_COLORS) {
                const optionRgb = hexToRgb(colorOption.hex);
                if (optionRgb) {
                    const distance = Math.sqrt(
                        Math.pow(inputRgb.r - optionRgb.r, 2) + Math.pow(inputRgb.g - optionRgb.g, 2) + Math.pow(inputRgb.b - optionRgb.b, 2)
                    );
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestColor = colorOption.name;
                    }
                }
            }
            return closestColor;
        }
    }
    return null;
};

// --- Stopwords ---
const STOP_WORDS = new Set([
    'this', 'is', 'a', 'an', 'the', 'of', 'in', 'and', 'for', 'with', 'on', 'at', 'to', 'from', 'by',
    'cake', 'themed', 'perfect', 'special', 'occasion', 'detailed', 'in', 'hues', 'capture', 'happiness',
    'moment', 'tier', '1', '2', '3', 'themed', 'features'
]);

// Extract tags carefully
function extractTags(row: any): string[] {
    const tags = new Set<string>();

    // 1. Keywords
    if (row.keywords) {
        row.keywords.split(',').forEach((kw: string) => {
            const clean = kw.trim().toLowerCase();
            if (clean) tags.add(clean);
        });
    }

    // 2. Icing Colors (from analysis_json)
    if (row.analysis_json?.icing_design?.colors) {
        const colorsObj = row.analysis_json.icing_design.colors;
        Object.values(colorsObj).forEach((colorHex) => {
            if (typeof colorHex === 'string') {
                const colorName = findClosestColorName(colorHex);
                if (colorName) tags.add(colorName);
            }
        });
    }

    // 3. Relevant tokens from Title, Alt Text, and SEO Description
    const extractWords = (text: string | null) => {
        if (!text) return;
        const words = text.split(/[^a-zA-Z0-9_-]+/);
        words.forEach(w => {
            const clean = w.toLowerCase().trim();
            if (clean.length > 2 && !STOP_WORDS.has(clean) && Number.isNaN(Number(clean))) {
                tags.add(clean);
            }
        });
    };

    extractWords(row.seo_title);
    extractWords(row.alt_text);
    // extractWords(row.seo_description); // SEO description might have too much noise, let's stick to title and alt_text which are dense.

    return Array.from(tags).filter(t => t.length > 0);
}

async function main() {
    console.log("Starting backfill for cakegenie_analysis_cache.tags...");
    let offset = 0;
    const batchSize = 1000;
    let totalUpdated = 0;

    while (true) {
        console.log(`Fetching rows ${offset} to ${offset + batchSize - 1}...`);
        const { data, error } = await supabase
            .from('cakegenie_analysis_cache')
            .select('id, keywords, analysis_json, seo_title, alt_text, seo_description')
            .range(offset, offset + batchSize - 1);

        if (error) {
            console.error("Error fetching data:", error);
            break;
        }

        if (!data || data.length === 0) {
            console.log("No more records to process.");
            break;
        }

        console.log(`Processing ${data.length} records...`);

        // Batch update is not natively supported directly, we can update in Promise.all using small batches or map
        // Since it's a script, we can do 100 concurrent updates
        for (let i = 0; i < data.length; i += 100) {
            const chunk = data.slice(i, i + 100);
            const promises = chunk.map(row => {
                const tags = extractTags(row);
                return supabase.from('cakegenie_analysis_cache').update({ tags }).eq('id', row.id);
            });

            await Promise.all(promises);
            totalUpdated += chunk.length;
            process.stdout.write(`\rUpdated ${totalUpdated} records so far...`);
        }
        console.log("");

        offset += batchSize;
        if (data.length < batchSize) {
            break;
        }
    }

    console.log(`Backfill complete. Updated ${totalUpdated} records.`);
}

main().catch(console.error);
