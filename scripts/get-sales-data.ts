import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // Try anon key first, if RLS allows reading orders
const supabase = createClient(supabaseUrl, supabaseKey);

async function getSalesData() {
  console.log('Fetching sales data from April 1 to April 18, 2026...');
  
  const startDate = '2026-04-01T00:00:00Z';
  const endDate = '2026-04-18T23:59:59Z';

  const { data, error } = await supabase
    .from('cakegenie_orders')
    .select('id, created_at, total_price, order_status, metadata')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching sales data:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No sales found for the specified period.');
    return;
  }

  console.log(`Found ${data.length} orders.`);
  
  // Group by day
  const dailySales: Record<string, { count: number; total: number; referrers: Set<string> }> = {};

  data.forEach((order) => {
    const day = new Date(order.created_at).toISOString().split('T')[0];
    if (!dailySales[day]) {
      dailySales[day] = { count: 0, total: 0, referrers: new Set() };
    }
    dailySales[day].count++;
    dailySales[day].total += order.total_price || 0;
    
    // Check metadata for referrer
    if (order.metadata && typeof order.metadata === 'object') {
      const meta = order.metadata as any;
      if (meta.referrer) dailySales[day].referrers.add(meta.referrer);
      if (meta.source) dailySales[day].referrers.add(meta.source);
      if (meta.utm_source) dailySales[day].referrers.add(`utm:${meta.utm_source}`);
    }
  });

  console.log('Daily Sales Report:');
  console.table(
    Object.entries(dailySales).map(([date, stats]) => ({
      Date: date,
      Orders: stats.count,
      Total: stats.total.toFixed(2),
      Referrers: Array.from(stats.referrers).join(', ')
    }))
  );
  
  // Also check columns of cakegenie_orders to see if I missed any referrer field
  const { data: columns, error: colError } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_name', 'cakegenie_orders');
    
  if (columns) {
    console.log('Columns in cakegenie_orders:', columns.map(c => c.column_name).join(', '));
  }
}

getSalesData();
