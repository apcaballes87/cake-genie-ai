const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function getEnv() {
  const envPath = path.join(process.cwd(), '.env');
  const envLocalPath = path.join(process.cwd(), '.env.local');
  let env = {};
  [envPath, envLocalPath].forEach(p => {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      content.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) env[key.trim()] = value.join('=').trim();
      });
    }
  });
  return env;
}

const env = getEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getSalesData() {
  const startDate = '2026-04-01T00:00:00Z';
  const endDate = '2026-04-18T23:59:59Z';

  console.log('Fetching daily sales from April 1 to 18, 2026...');

  const { data, error } = await supabase
    .from('cakegenie_orders')
    .select('*')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .eq('payment_status', 'paid')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No sales data found for the period.');
    return;
  }

  const dailyReport = {};
  data.forEach(order => {
    const day = order.created_at.split('T')[0];
    if (!dailyReport[day]) {
      dailyReport[day] = { count: 0, total: 0, sources: new Set() };
    }
    dailyReport[day].count++;
    dailyReport[day].total += order.total_amount || 0;
    
    // Check for source info in columns or metadata (guesswork based on common patterns)
    if (order.source) dailyReport[day].sources.add(order.source);
    if (order.utm_source) dailyReport[day].sources.add('utm:' + order.utm_source);
    if (order.referrer) dailyReport[day].sources.add(order.referrer);
    
    // Check if there's a metadata field
    if (order.metadata && typeof order.metadata === 'object') {
      const m = order.metadata;
      if (m.source) dailyReport[day].sources.add(m.source);
      if (m.utm_source) dailyReport[day].sources.add('utm:' + m.utm_source);
      if (m.referrer) dailyReport[day].sources.add(m.referrer);
    }
  });

  console.log('Daily Sales:');
  Object.entries(dailyReport).forEach(([day, stats]) => {
    console.log(`${day}: ${stats.count} orders, Total: ₱${stats.total.toLocaleString()}, Sources: ${Array.from(stats.sources).join(', ') || 'N/A'}`);
  });
}

getSalesData();
