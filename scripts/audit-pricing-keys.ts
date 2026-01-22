#!/usr/bin/env npx tsx
// scripts/audit-pricing-keys.ts
// Audit the pricing_rules table for inconsistencies with pricingEnums.ts
// Run with: npx tsx scripts/audit-pricing-keys.ts

import { createClient } from '@supabase/supabase-js';
import {
    MAIN_TOPPER_TYPES,
    SUPPORT_ELEMENT_TYPES,
    VALID_SIZES,
    SUBTYPES_BY_TYPE,
} from '../src/constants/pricingEnums';

// Use env vars or fallback to the anon key for read-only operations
const supabaseUrl = process.env.SUPABASE_URL || 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

const supabase = createClient(supabaseUrl, supabaseKey);

interface PricingRule {
    item_key: string;
    item_type: string;
    size: string | null;
    sub_item_type: string | null;
    category: string | null;
    is_active: boolean;
}

async function auditPricingRules() {
    console.log('🔍 Auditing pricing_rules table against pricingEnums.ts...\n');

    const { data, error } = await supabase
        .from('pricing_rules')
        .select('item_key, item_type, size, sub_item_type, category, is_active')
        .eq('is_active', true);

    if (error) {
        console.error('❌ Error fetching pricing rules:', error.message);
        return;
    }

    console.log(`📊 Found ${data.length} active pricing rules\n`);

    const allValidTypes = [...MAIN_TOPPER_TYPES, ...SUPPORT_ELEMENT_TYPES];
    const issues: string[] = [];
    const warnings: string[] = [];

    // Track unique types for summary
    const foundTypes = new Set<string>();
    const missingFromEnums = new Set<string>();

    (data as PricingRule[]).forEach(rule => {
        if (rule.item_type) {
            foundTypes.add(rule.item_type);
        }

        // Check for _light in item_key (naming inconsistency)
        if (rule.item_key?.includes('_light')) {
            issues.push(`❌ Legacy key naming: "${rule.item_key}" (should use "_small" instead of "_light")`);
        }

        // Check for invalid item_type
        if (rule.item_type && !allValidTypes.includes(rule.item_type as any)) {
            missingFromEnums.add(rule.item_type);
            warnings.push(`⚠️  Type not in pricingEnums: "${rule.item_type}" (item_key: ${rule.item_key})`);
        }

        // Check for invalid size
        if (rule.size && !VALID_SIZES.includes(rule.size as any) && rule.size !== 'light') {
            warnings.push(`⚠️  Invalid size: "${rule.size}" in "${rule.item_key}"`);
        }

        // Special check for "light" size
        if (rule.size === 'light') {
            issues.push(`❌ Legacy size: size="light" in "${rule.item_key}" (should be "small")`);
        }

        // Check subtypes
        if (rule.sub_item_type && rule.item_type) {
            const validSubtypes = SUBTYPES_BY_TYPE[rule.item_type as keyof typeof SUBTYPES_BY_TYPE] || [];
            if (validSubtypes.length > 0 && !validSubtypes.includes(rule.sub_item_type)) {
                warnings.push(`⚠️  Subtype "${rule.sub_item_type}" not in enum for type "${rule.item_type}"`);
            }
        }
    });

    // Print results
    console.log('═══════════════════════════════════════════════════════════════');

    if (issues.length === 0) {
        console.log('✅ No critical issues found (no _light keys or sizes)');
    } else {
        console.log(`\n🚨 CRITICAL ISSUES (${issues.length}):\n`);
        issues.forEach(issue => console.log(issue));
    }

    if (warnings.length > 0) {
        console.log(`\n⚠️  WARNINGS (${warnings.length}):\n`);
        warnings.forEach(warning => console.log(warning));
    }

    if (missingFromEnums.size > 0) {
        console.log('\n📝 Types in database but NOT in pricingEnums.ts:');
        console.log([...missingFromEnums].sort().join(', '));
        console.log('\n💡 TIP: Add these to pricingEnums.ts to enable validation');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('\n📊 Summary:');
    console.log(`   - Total active rules: ${data.length}`);
    console.log(`   - Unique types in DB: ${foundTypes.size}`);
    console.log(`   - Types in enums: ${allValidTypes.length}`);
    console.log(`   - Critical issues: ${issues.length}`);
    console.log(`   - Warnings: ${warnings.length}`);
}

auditPricingRules().catch(console.error);
