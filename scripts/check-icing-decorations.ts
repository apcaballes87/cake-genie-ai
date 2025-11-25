import { getSupabaseClient } from '../src/lib/supabase/client';

const supabase = getSupabaseClient();

async function checkIcingDecorations() {
  // Get all icing_decorations rules
  const { data: icingRules, error } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('item_type', 'icing_decorations')
    .eq('is_active', true);

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('\n=== ICING_DECORATIONS RULES ===\n');
  if (icingRules.length === 0) {
    console.log('❌ NO icing_decorations found in pricing_rules table');
  } else {
    icingRules.forEach((rule: any) => {
      console.log(`Rule ID: ${rule.rule_id}`);
      console.log(`  Item Key: ${rule.item_key}`);
      console.log(`  Category: ${rule.category}`);
      console.log(`  Classification: ${rule.classification}`);
      console.log(`  Size: ${rule.size}`);
      console.log(`  Coverage: ${rule.coverage}`);
      console.log(`  Price: ${rule.price}`);
      console.log(`  Description: ${rule.description}`);
      console.log('');
    });
  }

  // Check what types are available for support_element category
  const { data: supportTypes, error: supportError } = await supabase
    .from('pricing_rules')
    .select('item_type, category')
    .eq('category', 'support_element')
    .eq('is_active', true);

  if (supportError) {
    console.error('Error fetching support types:', supportError);
    process.exit(1);
  }

  const uniqueSupportTypes = [...new Set(supportTypes.map((r: any) => r.item_type))].sort();
  console.log('\n=== ALL SUPPORT_ELEMENT TYPES ===');
  console.log(uniqueSupportTypes.join(', '));
  console.log(`\nTotal: ${uniqueSupportTypes.length} types`);

  const hasIcingDec = uniqueSupportTypes.includes('icing_decorations');
  console.log(`\n${hasIcingDec ? '✅' : '❌'} icing_decorations ${hasIcingDec ? 'IS' : 'IS NOT'} in support_element category`);
}

checkIcingDecorations();
