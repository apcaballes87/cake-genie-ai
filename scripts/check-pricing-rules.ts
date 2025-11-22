import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPricingRules() {
  const { data, error } = await supabase
    .from('pricing_rules')
    .select('item_type, category, is_active')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('item_type', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${data.length} active pricing rules\n`);

  const mainToppers = data.filter(r => r.category === 'main_topper');
  const supportElements = data.filter(r => r.category === 'support_element');

  console.log('MAIN TOPPERS:', mainToppers.map(r => r.item_type).sort());
  console.log('\nSUPPORT ELEMENTS:', supportElements.map(r => r.item_type).sort());

  // Check for printout and cardstock specifically
  const hasPrintout = mainToppers.some(r => r.item_type === 'printout');
  const hasCardstock = mainToppers.some(r => r.item_type === 'cardstock');

  console.log('\n--- CRITICAL CHECK ---');
  console.log('Has printout in main_topper?', hasPrintout ? '✅ YES' : '❌ NO');
  console.log('Has cardstock in main_topper?', hasCardstock ? '✅ YES' : '❌ NO');

  if (hasCardstock && !hasPrintout) {
    console.log('\n🚨 PROBLEM FOUND: cardstock is allowed but printout is NOT!');
    console.log('This would force the AI to choose cardstock for character images!');
  }
}

checkPricingRules();
