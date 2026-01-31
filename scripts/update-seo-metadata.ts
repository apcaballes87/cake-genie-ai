#!/usr/bin/env npx tsx
// scripts/update-seo-metadata.ts

import { createClient } from '@supabase/supabase-js';

// --- Configuration ---

// Use env vars or fallback (copied from audit-pricing-keys.ts pattern)
const supabaseUrl = process.env.SUPABASE_URL || 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

const supabase = createClient(supabaseUrl, supabaseKey);

// Forbidden words (case-insensitive)
const FORBIDDEN_WORDS = [
    'buttercream',
    'soft icing',
    'royal icing', // generic icing
    'ganache',
    'yummy',
    'tasty',
    'delicious',
    'scrumptious',
    'moist', // taste/texture related
];

// Emotion bank
const EMOTIONS = [
    'joy',
    'delight',
    'happiness',
    'magic',
    'elegance',
    'wonder',
    'celebration',
    'excitement',
    'charm',
    'sophistication'
];

interface AnalysisJson {
    keyword?: string;
    cakeType?: string;
    icing_design?: {
        base?: string;
        colors?: Record<string, string>; // e.g., "top": "Hex" or just key-value
    };
    icing_surfaces?: Array<{ description?: string }>;
    main_toppers?: Array<{ description?: string; material?: string }>;
    support_elements?: Array<{ description?: string; material?: string }>;
    cake_messages?: Array<{ text?: string }>;
    colors?: string; // Sometimes inferred
}

interface CakeRecord {
    id: string;
    seo_title: string;
    analysis_json: AnalysisJson;
    alt_text?: string;
    seo_description?: string;
}

// --- Helpers ---

function getRandomEmotion(): string {
    return EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)];
}

function cleanText(text: string): string {
    let cleaned = text;
    // Simple regex to replace forbidden words with generic equivalents or remove them
    // For this task, we usually just want to avoid *mentioning* them. 
    // If they appear in descriptions, we try to strip them.

    FORBIDDEN_WORDS.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'yi'); // case insensitive
        cleaned = cleaned.replace(regex, '');
    });

    // Clean up double spaces
    return cleaned.replace(/\s+/g, ' ').trim();
}

function extractColors(analysis: AnalysisJson): string[] {
    const colors = new Set<string>();

    // From icing_design.colors
    if (analysis.icing_design?.colors) {
        Object.values(analysis.icing_design.colors).forEach(val => {
            // value might be hex or "Color: Hex" string. 
            // We want color names if possible, but often we only have hex or descriptions elsewhere.
            // If we have text descriptions in other fields, we can use those.
            // Actually, let's look at `icing_surfaces` descriptions for color names (e.g., "white fondant", "brown spots")
        });
    }

    const processDesc = (desc?: string) => {
        if (!desc) return;
        // Simple heuristic: match common color names
        const names = ['red', 'blue', 'green', 'yellow', 'pink', 'purple', 'black', 'white', 'gold', 'silver', 'brown', 'orange', 'pastel', 'neon', 'dark', 'light', 'ivory', 'cream', 'teal', 'navy', 'maroon', 'lavender', 'rose'];
        names.forEach(c => {
            if (desc.toLowerCase().includes(c)) {
                colors.add(c);
            }
        });
    };

    analysis.icing_surfaces?.forEach(s => processDesc(s.description));
    analysis.main_toppers?.forEach(t => processDesc(t.description));
    analysis.support_elements?.forEach(e => processDesc(e.description));

    // Also check the main "colors" string if it exists and looks like words
    // (The db sample showed colors as hex codes in a string map, but sometimes there's a keywords field)

    if (colors.size === 0) return ['colorful']; // fallback
    return Array.from(colors).slice(0, 3); // Top 3
}

function detectOccasion(keyword: string, age?: number): string {
    const k = keyword.toLowerCase();
    if (k.includes('wedding')) return 'Wedding';
    if (k.includes('christening') || k.includes('baptism') || k.includes('dedication')) return 'Christening';
    if (k.includes('anniversary')) return 'Anniversary';
    if (k.includes('birthday')) return 'Birthday';
    if (k.includes('debut')) return 'Debut';
    if (k.includes('valentine')) return 'Valentine\'s Day';
    if (k.includes('christmas') || k.includes('holiday')) return 'Holiday celebration';
    if (k.includes('graduation')) return 'Graduation';

    // If age is detected, likely a birthday
    if (age !== undefined) return 'Birthday';

    return 'special occasion';
}

function detectAge(analysis: AnalysisJson): number | undefined {
    let age: number | undefined;
    analysis.cake_messages?.forEach(msg => {
        const txt = msg.text?.trim();
        if (txt && /^\d+$/.test(txt)) { // strictly digits
            age = parseInt(txt, 10);
        } else if (txt && /(\d+)(st|nd|rd|th)/i.test(txt)) { // 1st, 2nd
            const match = txt.match(/(\d+)/);
            if (match) age = parseInt(match[1], 10);
        }
    });
    return age;
}

// --- Generation Logic ---

function generateMetadata(record: CakeRecord): { newAlt: string; newDesc: string } {
    const analysis = record.analysis_json;
    let keyword = cleanText(analysis.keyword || '');

    // Fallback if keyword is missing or too generic
    if (!keyword || keyword.toLowerCase() === 'custom' || keyword.toLowerCase() === 'cake') {
        // seo_title format often: "Description | Genie.ph" or "Description Cake | Genie.ph"
        if (record.seo_title) {
            const titlePart = record.seo_title.split('|')[0].trim();
            // Remove "Cake" from the end if present to get the theme/keyword
            const candidate = titlePart.replace(/(\s+cake)$/i, '').trim();
            if (candidate && candidate.length > 2) {
                keyword = cleanText(candidate);
            }
        }
    }
    if (!keyword) keyword = 'custom';

    const cakeType = cleanText(analysis.cakeType || 'Cake');
    const colors = extractColors(analysis);
    const age = detectAge(analysis);
    const occasion = detectOccasion(keyword, age);
    const emotion = getRandomEmotion();

    // Collect motif/details
    const details: string[] = [];
    if (analysis.main_toppers && analysis.main_toppers.length > 0) {
        details.push(cleanText(analysis.main_toppers[0].description || 'toppers'));
    }
    if (analysis.support_elements && analysis.support_elements.length > 0) {
        details.push(cleanText(analysis.support_elements[0].description || 'decorations'));
    }

    const motifStr = details.length > 0 ? details.join(' and ') : 'intricate details';
    const colorStr = colors.join(', ');

    // --- ALT TEXT ---
    // "{Keyword} {Cake Type} - {Colors} theme with {Toppers summary}"
    let newAlt = `${keyword} ${cakeType} - ${colorStr} theme with ${motifStr}`;
    // Cleanup
    newAlt = newAlt.replace(/\s+/g, ' ').trim();
    if (newAlt.length > 125) newAlt = newAlt.substring(0, 122) + '...'; // truncate if too long for alt

    // --- SEO DESCRIPTION ---
    // "Get instant pricing for this {Keyword} themed {Cake Type}. Perfect for a {Occasion}, detailed with {Toppers/Motif} in {Colors} hues. {Age sentence if applicable}. Capture the {Emotion} of the moment. Get the price of any cake instantly at genie.ph."

    let descParts = [
        `Get instant pricing for this ${keyword} themed ${cakeType}.`,
        `Perfect for a ${occasion}, detailed with ${motifStr} in ${colorStr} hues.`
    ];

    if (age) {
        descParts.push(`Celebrate the ${age}${getOrdinal(age)} milestone in style.`);
    }

    descParts.push(`Capture the ${emotion} of the moment.`);
    descParts.push(`Get the price of any cake instantly at genie.ph.`);

    let newDesc = descParts.join(' ');
    newDesc = cleanText(newDesc);

    return { newAlt, newDesc };
}

function getOrdinal(n: number): string {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

// --- Main Execution ---

async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    console.log(`🚀 Starting SEO Metadata Update (Dry Run: ${isDryRun})...`);

    // Fetch all records
    // In a real localized script for 858 records, fetching all is fine. 
    // Pagination might be safer but 858 is small enough.
    const { data: records, error } = await supabase
        .from('cakegenie_analysis_cache')
        .select('id, seo_title, analysis_json, alt_text, seo_description');

    if (error) {
        console.error('❌ Error fetching records:', error);
        return;
    }

    if (!records || records.length === 0) {
        console.log('⚠️ No records found.');
        return;
    }

    console.log(`found ${records.length} records.`);

    let updatedCount = 0;

    for (const record of records) {
        try {
            const { newAlt, newDesc } = generateMetadata(record as any);

            if (isDryRun && updatedCount < 5) {
                console.log(`\n------------------------------------------------`);
                console.log(`ID: ${record.id}`);
                console.log(`OLD Alt: ${record.alt_text}`);
                console.log(`NEW Alt: ${newAlt}`);
                console.log(`OLD Desc: ${record.seo_description}`);
                console.log(`NEW Desc: ${newDesc}`);
            }

            if (!isDryRun) {
                const { error: updateError } = await supabase
                    .from('cakegenie_analysis_cache')
                    .update({
                        seo_description: newDesc,
                        alt_text: newAlt
                    })
                    .eq('id', record.id);

                if (updateError) {
                    console.error(`❌ Failed to update ${record.id}:`, updateError.message);
                } else {
                    process.stdout.write('.'); // progress dot
                }
            }
            updatedCount++;
        } catch (e) {
            console.error(`❌ Error processing ${record.id}:`, e);
        }
    }

    console.log(`\n\n✅ Processed ${updatedCount} records.`);
    if (isDryRun) {
        console.log('ℹ️  This was a DRY RUN. No changes were made.');
        console.log('ℹ️  Run without --dry-run to apply changes.');
    }
}

main().catch(console.error);
