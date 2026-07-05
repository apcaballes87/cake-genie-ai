import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

type BuyerOrderRow = {
  order_id: string;
  order_number: string;
  created_at: string;
  payment_status: string;
  total_amount: number;
  buyer_first_touch_source: string | null;
  buyer_purchase_session_source: string | null;
  buyer_attribution: Record<string, unknown> | null;
  ga_purchase_mirrored_at: string | null;
  buyer?: { email: string | null } | null;
};

interface CliOptions {
  from: string | null;
  to: string | null;
  excludeEmails: string[];
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    from: null,
    to: null,
    excludeEmails: ['apcaballes@gmail.com'],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--from' && next) {
      options.from = next;
      index += 1;
      continue;
    }

    if (arg === '--to' && next) {
      options.to = next;
      index += 1;
      continue;
    }

    if (arg === '--exclude-email' && next) {
      options.excludeEmails.push(next.toLowerCase());
      index += 1;
    }
  }

  return options;
}

function incrementCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function formatCounts(map: Map<string, number>): Array<{ source: string; orders: number }> {
  return [...map.entries()]
    .map(([source, orders]) => ({ source, orders }))
    .sort((left, right) => right.orders - left.orders || left.source.localeCompare(right.source));
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  const options = parseArgs(process.argv.slice(2));
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let query = supabase
    .from('cakegenie_orders')
    .select(`
      order_id,
      order_number,
      created_at,
      payment_status,
      total_amount,
      buyer_first_touch_source,
      buyer_purchase_session_source,
      buyer_attribution,
      ga_purchase_mirrored_at,
      buyer:cakegenie_users!cakegenie_orders_user_id_fkey(email)
    `)
    .in('payment_status', ['paid', 'partial'])
    .order('created_at', { ascending: true });

  if (options.from) {
    query = query.gte('created_at', `${options.from}T00:00:00Z`);
  }

  if (options.to) {
    query = query.lte('created_at', `${options.to}T23:59:59Z`);
  }

  const rows: BuyerOrderRow[] = [];
  let fromIndex = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await query.range(fromIndex, fromIndex + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...(data as BuyerOrderRow[]));
    if (data.length < pageSize) break;
    fromIndex += pageSize;
  }

  const excluded = new Set(options.excludeEmails.map((email) => email.toLowerCase()));
  const filteredRows = rows.filter((row) => !excluded.has((row.buyer?.email ?? '').toLowerCase()));

  const firstTouchCounts = new Map<string, number>();
  const purchaseSessionCounts = new Map<string, number>();
  const differingRows: BuyerOrderRow[] = [];
  const missingAttributionRows: BuyerOrderRow[] = [];
  const missingMirrorRows: BuyerOrderRow[] = [];

  for (const row of filteredRows) {
    const firstTouchSource = row.buyer_first_touch_source ?? '(missing)';
    const purchaseSessionSource = row.buyer_purchase_session_source ?? '(missing)';

    incrementCount(firstTouchCounts, firstTouchSource);
    incrementCount(purchaseSessionCounts, purchaseSessionSource);

    if (
      row.buyer_first_touch_source &&
      row.buyer_purchase_session_source &&
      row.buyer_first_touch_source !== row.buyer_purchase_session_source
    ) {
      differingRows.push(row);
    }

    const attributionKeys = row.buyer_attribution ? Object.keys(row.buyer_attribution) : [];
    if (
      !row.buyer_first_touch_source ||
      !row.buyer_purchase_session_source ||
      attributionKeys.length === 0
    ) {
      missingAttributionRows.push(row);
    }

    if (!row.ga_purchase_mirrored_at) {
      missingMirrorRows.push(row);
    }
  }

  console.log('');
  console.log('Buyer attribution audit');
  console.log('======================');
  console.log(`Orders scanned: ${filteredRows.length}`);
  console.log(`Excluded emails: ${options.excludeEmails.join(', ')}`);
  console.log('');
  console.log('By first-touch source');
  console.table(formatCounts(firstTouchCounts));
  console.log('By purchase-session source');
  console.table(formatCounts(purchaseSessionCounts));

  if (differingRows.length > 0) {
    console.log('Rows where first-touch and purchase-session differ');
    console.table(
      differingRows.map((row) => ({
        order_number: row.order_number,
        email: row.buyer?.email ?? '(unknown)',
        first_touch: row.buyer_first_touch_source,
        purchase_session: row.buyer_purchase_session_source,
      })),
    );
  }

  if (missingAttributionRows.length > 0) {
    console.log('Rows missing attribution');
    console.table(
      missingAttributionRows.map((row) => ({
        order_number: row.order_number,
        email: row.buyer?.email ?? '(unknown)',
        first_touch: row.buyer_first_touch_source ?? '(missing)',
        purchase_session: row.buyer_purchase_session_source ?? '(missing)',
      })),
    );
  }

  if (missingMirrorRows.length > 0) {
    console.log('Rows missing mirrored purchase state');
    console.table(
      missingMirrorRows.map((row) => ({
        order_number: row.order_number,
        email: row.buyer?.email ?? '(unknown)',
        payment_status: row.payment_status,
        mirrored_at: row.ga_purchase_mirrored_at ?? '(missing)',
      })),
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null
      ? JSON.stringify(error)
      : String(error);
  if (message.includes('buyer_first_touch_source')) {
    console.error(
      'Buyer attribution columns are not available yet. Apply migration 20260705144506_buyer_attribution_hardening.sql before running this audit.',
    );
  } else {
    console.error(message);
  }
  process.exit(1);
});
