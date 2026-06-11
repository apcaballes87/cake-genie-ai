import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { generateDesignDetails, generateDynamicFAQ } from '../src/utils/designContentUtils';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Define a threshold for what constitutes "thin" page-specific content
const MIN_UNIQUE_WORDS = 250;

/**
 * Calculates the Jaccard similarity index between two sets of words.
 * Jaccard = (A intersection B) / (A union B)
 */
function calculateJaccardSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().match(/\b\w+\b/g) || []);
    const words2 = new Set(text2.toLowerCase().match(/\b\w+\b/g) || []);
    
    if (words1.size === 0 && words2.size === 0) return 1.0;
    if (words1.size === 0 || words2.size === 0) return 0.0;
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
}

/**
 * Strips the known static boilerplate text to extract the truly unique page-specific content.
 */
function getUniqueContent(design: any): { 
    uniqueText: string; 
    totalWordCount: number; 
    uniqueWordCount: number; 
    boilerplateWordCount: number;
} {
    const details = generateDesignDetails(design, []);
    const faqs = generateDynamicFAQ(design, []);
    
    // Combine all generated texts
    const faqText = faqs.map(f => `${f.question} ${f.answer}`).join(' ');
    const specsText = `
        Cake Style: ${design.analysis_json?.cakeType || ''} ${design.keywords || ''}
        Icing Finish: ${design.analysis_json?.icing_design?.base || ''}
        Features: ${(design.analysis_json?.main_toppers || []).map((t: any) => t.description || t.type).join(', ')}
        Decorations: ${(design.analysis_json?.support_elements || []).map((s: any) => s.description || s.type).join(', ')}
        Tags: ${(design.tags || []).join(', ')}
    `;
    
    const fullText = `${details} ${faqText} ${specsText}`;
    const totalWords = fullText.split(/\s+/).filter(Boolean).length;
    
    // Standard template boilerplate strings (approximate word lists) that are identical across pages
    const staticBoilerplatePhrases = [
        "simply select your desired size and height options from the configuration menu above",
        "the price will update in real time and be displayed in the add to cart bar at the bottom of the screen",
        "we recommend ordering at least 1 to 2 days in advance to ensure our bakers can craft every detail perfectly",
        "order by 3 pm for next-day delivery slots",
        "yes, we offer free delivery for this",
        "throughout metro cebu, including cebu city, mandaue, mactan, lapu-lapu, and talisay",
        "we also serve select areas in cavite",
        "all cakes are delivered fresh by our partner bakers to ensure quality",
        "yes, you can fully customize this design",
        "use our ai-powered customizer to swap, add, or remove individual elements and see how each change affects the price in real time",
        "we accept e-wallets (gcash and maya), bank transfers (bdo, bpi, and metrobank), and all major credit and debit cards processed securely via xendit",
        "you can choose your preferred payment method at checkout",
        "free delivery is available throughout metro cebu, including cebu city, mandaue, lapu-lapu, and talisay",
        "ordering & policy details",
        "delivery coverage and fees",
        "review the return and cancellation policy",
        "browse genie.ph customer reviews"
    ];
    
    let cleanedText = fullText.toLowerCase();
    for (const phrase of staticBoilerplatePhrases) {
        cleanedText = cleanedText.replace(phrase.toLowerCase(), '');
    }
    
    // Clean up extra spaces
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
    
    const uniqueWordCount = cleanedText.split(/\s+/).filter(Boolean).length;
    const boilerplateWordCount = Math.max(0, totalWords - uniqueWordCount);
    
    return {
        uniqueText: cleanedText,
        totalWordCount: totalWords,
        uniqueWordCount: uniqueWordCount,
        boilerplateWordCount: boilerplateWordCount
    };
}

async function runAudit() {
    console.log('====================================================');
    console.log('🚀 Starting SEO Thin Content Audit for /customizing/[slug]');
    console.log('====================================================');
    
    // Fetch a representative sample of 250 records to evaluate
    console.log('Fetching sample records from cakegenie_analysis_cache...');
    const { data: records, error } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(250);
        
    if (error) {
        console.error('Error fetching records:', error);
        return;
    }
    
    if (!records || records.length === 0) {
        console.log('No records found in cache.');
        return;
    }
    
    console.log(`Successfully fetched ${records.length} records.`);
    
    let criticalCount = 0; // < 150 unique words
    let lowCount = 0;      // 150 - 250 unique words
    let goodCount = 0;     // 250 - 400 unique words
    let excellentCount = 0; // > 400 unique words
    let missingAnalysisCount = 0;
    
    let sumTotalWords = 0;
    let sumUniqueWords = 0;
    
    const processedRecords = records.map((record) => {
        const isMissingAnalysis = !record.analysis_json;
        if (isMissingAnalysis) {
            missingAnalysisCount++;
        }
        
        const metrics = getUniqueContent(record);
        
        sumTotalWords += metrics.totalWordCount;
        sumUniqueWords += metrics.uniqueWordCount;
        
        if (metrics.uniqueWordCount < 150) {
            criticalCount++;
        } else if (metrics.uniqueWordCount < MIN_UNIQUE_WORDS) {
            lowCount++;
        } else if (metrics.uniqueWordCount < 400) {
            goodCount++;
        } else {
            excellentCount++;
        }
        
        return {
            slug: record.slug,
            keywords: record.keywords,
            isMissingAnalysis,
            uniqueText: metrics.uniqueText,
            uniqueWordCount: metrics.uniqueWordCount,
            totalWordCount: metrics.totalWordCount
        };
    });
    
    // Calculate average similarity on a random sub-sample of 30 pages to measure layout duplication index
    console.log('\nAnalyzing template similarity (Jaccard Overlap Index)...');
    const similaritySample = processedRecords.slice(0, 30);
    let similaritySum = 0;
    let comparisonsCount = 0;
    
    for (let i = 0; i < similaritySample.length; i++) {
        for (let j = i + 1; j < similaritySample.length; j++) {
            const sim = calculateJaccardSimilarity(
                similaritySample[i].uniqueText,
                similaritySample[j].uniqueText
            );
            similaritySum += sim;
            comparisonsCount++;
        }
    }
    
    const averageSimilarity = comparisonsCount > 0 ? (similaritySum / comparisonsCount) * 100 : 0;
    
    const avgTotalWords = Math.round(sumTotalWords / records.length);
    const avgUniqueWords = Math.round(sumUniqueWords / records.length);
    
    console.log('\n====================================================');
    console.log('📊 AUDIT SUMMARY REPORT');
    console.log('====================================================');
    console.log(`Total Pages Audited:         ${records.length}`);
    console.log(`Avg Total Word Count:        ${avgTotalWords} words`);
    console.log(`Avg Unique Word Count:       ${avgUniqueWords} words`);
    console.log(`Avg Boilerplate Word Count:  ${avgTotalWords - avgUniqueWords} words`);
    console.log(`Average Page Similarity:     ${averageSimilarity.toFixed(1)}%`);
    console.log('----------------------------------------------------');
    console.log('Quality Classification (By Unique Word Count):');
    console.log(`🔴 CRITICAL (<150 words):     ${criticalCount} (${((criticalCount / records.length) * 100).toFixed(1)}%)`);
    console.log(`🟡 LOW (150-250 words):       ${lowCount} (${((lowCount / records.length) * 100).toFixed(1)}%)`);
    console.log(`🟢 GOOD (250-400 words):      ${goodCount} (${((goodCount / records.length) * 100).toFixed(1)}%)`);
    console.log(`✨ EXCELLENT (>400 words):    ${excellentCount} (${((excellentCount / records.length) * 100).toFixed(1)}%)`);
    console.log('----------------------------------------------------');
    console.log(`Pages Missing AI Analysis:   ${missingAnalysisCount} (${((missingAnalysisCount / records.length) * 100).toFixed(1)}%)`);
    console.log('====================================================');
    
    // Display some of the critical or low pages to help locate issues
    const problematicPages = processedRecords
        .filter(r => r.uniqueWordCount < MIN_UNIQUE_WORDS)
        .slice(0, 10);
        
    if (problematicPages.length > 0) {
        console.log('\n⚠️ SAMPLE OF PAGES REQUIRING QUALITY ENRICHMENT:');
        console.log('----------------------------------------------------');
        console.log('| Slug | Keywords | Unique Words | AI Analysis? |');
        console.log('----------------------------------------------------');
        problematicPages.forEach(p => {
            console.log(`| ${p.slug.substring(0, 30)} | ${p.keywords || 'N/A'} | ${p.uniqueWordCount} | ${p.isMissingAnalysis ? '❌ NO' : '✅ YES'} |`);
        });
        console.log('----------------------------------------------------');
    }
    
    // Interpretation guidelines
    console.log('\n💡 SEO ACTION RECOMMENDATIONS:');
    if (averageSimilarity > 75) {
        console.log('❌ HIGH SIMILARITY (Over 75%): Your pages are too similar. Google may treat them as duplicate templates. Action: Increase the entropy/randomization of sentences in generateDesignDetails.');
    } else if (averageSimilarity > 60) {
        console.log('⚠️ MODERATE SIMILARITY (60%-75%): Healthy but can be improved. Try introducing more dynamic variables into the FAQ answers.');
    } else {
        console.log('✅ LOW SIMILARITY (Under 60%): Excellent! The content variants are highly distinct.');
    }
    
    if (criticalCount + lowCount > 0) {
        console.log('⚠️ THIN CONTENT DETECTED: Some pages have less than 250 unique words. Action: Backfill missing AI analyses, and expand the tags/descriptions for these pages.');
    } else {
        console.log('✅ CONTENT DEPTH HEALTHY: All sampled pages exceed the 250 unique word threshold.');
    }
    console.log('====================================================\n');
}

runAudit();
