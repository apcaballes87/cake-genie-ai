import { getSupabaseClient } from '../src/lib/supabase/client';

const supabase = getSupabaseClient();

async function addMissingSupportTypes() {
  console.log('\n=== ADDING MISSING SUPPORT ELEMENT TYPES ===\n');

  // Add icing_decorations for support_element category
  const icingDecRules = [
    {
      item_key: 'icing_decorations_small',
      item_type: 'icing_decorations',
      category: 'support_element',
      classification: 'icing',
      size: 'small',
      coverage: null,
      description: 'Small icing decorations (piped swirls, dollops)',
      price: 0,
      quantity_rule: null,
      multiplier_rule: null,
      special_conditions: null,
      is_active: true
    },
    {
      item_key: 'icing_decorations_medium',
      item_type: 'icing_decorations',
      category: 'support_element',
      classification: 'icing',
      size: 'medium',
      coverage: null,
      description: 'Medium icing decorations (piped swirls, dollops)',
      price: 0,
      quantity_rule: null,
      multiplier_rule: null,
      special_conditions: null,
      is_active: true
    },
    {
      item_key: 'icing_decorations_large',
      item_type: 'icing_decorations',
      category: 'support_element',
      classification: 'icing',
      size: 'large',
      coverage: null,
      description: 'Large icing decorations (piped swirls, dollops)',
      price: 0,
      quantity_rule: null,
      multiplier_rule: null,
      special_conditions: null,
      is_active: true
    },
    {
      item_key: 'icing_decorations_tiny',
      item_type: 'icing_decorations',
      category: 'support_element',
      classification: 'icing',
      size: 'tiny',
      coverage: null,
      description: 'Tiny icing decorations (piped swirls, dollops)',
      price: 0,
      quantity_rule: null,
      multiplier_rule: null,
      special_conditions: null,
      is_active: true
    }
  ];

  console.log('📝 Inserting icing_decorations rules for support_element...\n');

  for (const rule of icingDecRules) {
    const { data, error } = await supabase
      .from('pricing_rules')
      .insert(rule)
      .select();

    if (error) {
      console.error(`❌ Failed to insert ${rule.item_key}:`, error.message);
    } else {
      console.log(`✅ Added: ${rule.item_key} (size: ${rule.size})`);
    }
  }

  // Verify the insertion
  console.log('\n🔍 Verifying insertion...\n');

  const { data: verifyData, error: verifyError } = await supabase
    .from('pricing_rules')
    .select('item_key, category, classification, size')
    .eq('item_type', 'icing_decorations')
    .eq('category', 'support_element')
    .eq('is_active', true);

  if (verifyError) {
    console.error('❌ Verification failed:', verifyError);
  } else if (verifyData.length === 0) {
    console.log('⚠️  No support_element icing_decorations rules found after insertion!');
  } else {
    console.log('✅ Successfully added icing_decorations to support_element category:');
    verifyData.forEach(rule => {
      console.log(`   - ${rule.item_key} (${rule.classification})`);
    });
  }

  console.log('\n✨ Done!\n');
}

addMissingSupportTypes().catch(console.error);
