/**
 * Backfill script: Computes and sets the `availability` column for all rows in
 * `cakegenie_analysis_cache` that have `analysis_json` but no `availability` value.
 *
 * Usage: npx tsx scripts/backfill-availability.ts
 */

import { createClient } from '@supabase/supabase-js';

// --- Inline availability logic (matches src/lib/utils/availability.ts) ---
type AvailabilityType = 'rush' | 'same-day' | 'normal';

interface DesignData {
    cakeType: string;
    cakeSize: string;
    icingBase: string;
    drip: boolean;
    gumpasteBaseBoard: boolean;
    mainToppers: { type: string; description: string }[];
    supportElements: { type: string; description: string }[];
}

const getDesignAvailability = (design: DesignData): AvailabilityType => {
    const allItems = [...design.mainToppers, ...design.supportElements];

    const isStructurallyComplex = [
        '2 Tier', '3 Tier', '1 Tier Fondant', '2 Tier Fondant', '3 Tier Fondant', 'Square', 'Rectangle',
    ].includes(design.cakeType) || design.icingBase === 'fondant';

    const hasHighlyComplexDecorations = allItems.some(
        (item) =>
            ['edible_3d_complex', 'edible_3d_ordinary'].includes(item.type) ||
            item.type === 'edible_2d_support' ||
            item.type === 'edible_flowers'
    );

    if (isStructurallyComplex || hasHighlyComplexDecorations || design.drip || design.gumpasteBaseBoard) {
        return 'normal';
    }

    const hasSameDayDecorations = allItems.some(
        (item) =>
            item.type === 'edible_2d_support' ||
            (item.type === 'edible_3d_support' && !item.description.toLowerCase().includes('dots')) ||
            item.type === 'edible_photo_top' ||
            item.type === 'edible_photo_side' ||
            item.type === 'icing_doodle'
    );

    if (hasSameDayDecorations) {
        return 'same-day';
    }

    const isRushEligibleBase =
        (design.cakeType === '1 Tier' && (design.cakeSize === '6" Round' || design.cakeSize === '8" Round')) ||
        design.cakeType === 'Bento';

    if (isRushEligibleBase) {
        return 'rush';
    }

    return 'normal';
};

// --- Main backfill logic ---
const main = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Fetching rows with missing availability...');

    const { data: rows, error } = await supabase
        .from('cakegenie_analysis_cache')
        .select('p_hash, analysis_json')
        .is('availability', null)
        .not('analysis_json', 'is', null);

    if (error) {
        console.error('❌ Query error:', error);
        process.exit(1);
    }

    if (!rows || rows.length === 0) {
        console.log('✅ No rows need backfilling. All done!');
        return;
    }

    console.log(`📦 Found ${rows.length} rows to backfill.`);

    let updated = 0;
    let errors = 0;

    for (const row of rows) {
        const analysis = row.analysis_json;
        if (!analysis) continue;

        const mainToppers = (analysis.main_toppers || []).map((t: any) => ({
            type: t.type,
            description: t.description || '',
        }));
        const supportElements = (analysis.support_elements || []).map((s: any) => ({
            type: s.type,
            description: s.description || '',
        }));

        const availability = getDesignAvailability({
            cakeType: analysis.cakeType || '1 Tier',
            cakeSize: '6" Round',
            icingBase: analysis.icing_design?.base || 'soft_icing',
            drip: analysis.icing_design?.drip || false,
            gumpasteBaseBoard: analysis.icing_design?.gumpasteBaseBoard || false,
            mainToppers,
            supportElements,
        });

        const { error: updateError } = await supabase
            .from('cakegenie_analysis_cache')
            .update({ availability })
            .eq('p_hash', row.p_hash);

        if (updateError) {
            console.error(`  ❌ Failed to update ${row.p_hash}:`, updateError.message);
            errors++;
        } else {
            updated++;
        }
    }

    console.log(`\n✅ Backfill complete: ${updated} updated, ${errors} errors.`);
};

main().catch((err) => {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
});
