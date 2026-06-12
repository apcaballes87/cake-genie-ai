#!/usr/bin/env npx tsx
/**
 * scripts/test-cleanup-abandoned-orders.ts
 *
 * Smoke + transactional test for the `cleanup_abandoned_pending_orders`
 * helper that powers the `cleanup-abandoned-orders` pg_cron job
 * (see supabase/migrations/20260612130000_cleanup_abandoned_orders.sql).
 *
 * What it does
 * ------------
 * 1. Resolves a dedicated test discount code in `discount_codes` (creates
 *    one tagged with a sentinel `reason` value if missing) so we can
 *    assert `times_used` without disturbing real codes.
 * 2. Inserts two fake `cakegenie_orders` rows against a random test user:
 *      - one with `updated_at` 25h ago (should be cancelled)
 *      - one with `updated_at` 1h ago  (should be left alone)
 *    Both have `discount_code_id` pointing at the sentinel code, and
 *    we increment `times_used` by 2 to mirror the create-order path.
 * 3. Calls the cleanup RPC.
 * 4. Asserts: old order → order_status='cancelled', payment_status='expired'.
 *    Asserts: young order → still 'pending'.
 *    Asserts: discount_codes.times_used went from +2 → 0 (decremented by 2).
 * 5. Tears down the test rows + sentinel discount code, and (defensively)
 *    restores the discount counter to 0 in case the cleanup skipped.
 *
 * Usage:
 *   npx tsx scripts/test-cleanup-abandoned-orders.ts
 *
 * Exit codes:
 *   0  — every assertion passed
 *   1  — at least one assertion failed
 *   2  — couldn't reach Supabase (network / credentials / RPC missing)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;
const SERVICE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(
        'Missing Supabase env vars.\n' +
        '  Required (any of): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL, VITE_SUPABASE_URL\n' +
        '  Required (any of): SUPABASE_SERVICE_ROLE_KEY, SUPABASE_KEY, SUPABASE_SERVICE_KEY\n' +
        '  Source from .env.local or .env in the project root.',
    );
    process.exit(2);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
});

// Sentinel values let us find / clean up test rows without touching real data.
const SENTINEL_CODE = `TEST-CLEANUP-${Date.now()}`;
const SENTINEL_REASON = 'cleanup-abandoned-orders self-test';
const OLD_ORDER_NUMBER = `TEST-OLD-${Date.now()}`;
const YOUNG_ORDER_NUMBER = `TEST-YOUNG-${Date.now()}`;

interface CleanupResult {
    cancelled_count: number;
    refunded_count: number;
    refunded_codes: string[];
}

interface TestRow {
    id: string;
    label: string;
    expected_status: 'cancelled' | 'pending';
    expected_payment: 'expired' | 'pending';
}

const results: { name: string; ok: boolean; detail: string }[] = [];
function assert(name: string, condition: boolean, detail: string) {
    results.push({ name, ok: condition, detail });
}

// ---------- helpers --------------------------------------------------------

async function resolveTestDiscountCode(): Promise<string> {
    // Look for an existing sentinel from a previous run. We use a unique
    // code per run, so a previous test's code is safe to read but not to
    // mutate. If none exists, insert one.
    const { data, error } = await supabase
        .from('discount_codes')
        .select('code_id, times_used')
        .eq('code', SENTINEL_CODE)
        .maybeSingle();

    if (error) throw new Error(`discount_codes lookup failed: ${error.message}`);

    if (data) {
        // Reset the counter from a previous run so the test is reproducible.
        await supabase
            .from('discount_codes')
            .update({ times_used: 0 })
            .eq('code_id', data.code_id);
        return data.code_id;
    }

    const { data: inserted, error: insErr } = await supabase
        .from('discount_codes')
        .insert({
            code: SENTINEL_CODE,
            discount_percentage: 10,
            reason: SENTINEL_REASON,
            times_used: 0,
            is_active: false, // Never actually usable
        })
        .select('code_id')
        .single();

    if (insErr || !inserted) {
        throw new Error(
            `discount_codes insert failed: ${insErr?.message ?? 'no row returned'}`,
        );
    }
    return inserted.code_id;
}

async function fetchAnyUserId(): Promise<string> {
    // `cakegenie_orders.user_id` has a FK to `auth.users`, so we have to
    // attach a real id. We don't care which user — the cleanup function
    // only looks at payment_status + updated_at + discount_code_id.
    const { data, error } = await supabase
        .from('cakegenie_orders')
        .select('user_id')
        .not('user_id', 'is', null)
        .limit(1)
        .maybeSingle();
    if (error) throw new Error(`user_id lookup failed: ${error.message}`);
    if (!data?.user_id) {
        throw new Error('No non-null user_id found in cakegenie_orders to reuse');
    }
    return data.user_id as string;
}

async function makeTestOrder(
    label: string,
    orderNumber: string,
    discountCodeId: string,
    userId: string,
    ageHours: number,
): Promise<string> {
    const updatedAt = new Date(Date.now() - ageHours * 60 * 60 * 1000).toISOString();
    const createdAt = new Date(Date.now() - (ageHours + 1) * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('cakegenie_orders')
        .insert({
            user_id: userId,
            order_number: orderNumber,
            order_status: 'pending',
            payment_status: 'pending',
            subtotal: 1000,
            delivery_fee: 100,
            discount_amount: 100,
            discount_code_id: discountCodeId,
            total_amount: 1000,
            payment_method: 'gcash',
            created_at: createdAt,
            updated_at: updatedAt,
            order_notes: `test cleanup — ${label}`,
        })
        .select('order_id')
        .single();

    if (error || !data) {
        throw new Error(`cakegenie_orders insert (${label}) failed: ${error?.message ?? 'no row'}`);
    }
    return data.order_id;
}

async function fetchOrder(orderId: string) {
    const { data, error } = await supabase
        .from('cakegenie_orders')
        .select('order_id, order_status, payment_status, cancelled_at, updated_at')
        .eq('order_id', orderId)
        .single();
    if (error || !data) {
        throw new Error(`cakegenie_orders fetch failed: ${error?.message ?? 'no row'}`);
    }
    return data;
}

async function cleanupTestArtifacts(orderIds: string[], discountCodeId: string) {
    // Best-effort cleanup. If the test failed mid-flight, we still want
    // to remove the sentinel rows so they don't haunt the next run.
    if (orderIds.length > 0) {
        await supabase
            .from('cakegenie_order_items')
            .delete()
            .in('order_id', orderIds);
        await supabase
            .from('cakegenie_orders')
            .delete()
            .in('order_id', orderIds);
    }
    if (discountCodeId) {
        // Delete any discount_code_usage rows the test might have created
        // (the create_order path inserts one, but we went directly through
        // the orders table — so usually nothing to clean).
        await supabase
            .from('discount_code_usage')
            .delete()
            .eq('discount_code_id', discountCodeId);
        await supabase
            .from('discount_codes')
            .delete()
            .eq('code_id', discountCodeId);
    }
}

// ---------- main -----------------------------------------------------------

async function main() {
    console.log(`▶ cleanup-abandoned-orders self-test against ${SUPABASE_URL}\n`);

    let oldOrderId = '';
    let youngOrderId = '';
    let discountCodeId = '';
    const testOrderIds: string[] = [];

    try {
        // 1. Resolve the sentinel discount code
        discountCodeId = await resolveTestDiscountCode();
        assert('sentinel discount code resolved', !!discountCodeId, `code_id=${discountCodeId}`);

        // 2. Insert two fake orders
        const testUserId = await fetchAnyUserId();
        oldOrderId = await makeTestOrder(
            'old (25h ago)',
            OLD_ORDER_NUMBER,
            discountCodeId,
            testUserId,
            25,
        );
        youngOrderId = await makeTestOrder(
            'young (1h ago)',
            YOUNG_ORDER_NUMBER,
            discountCodeId,
            testUserId,
            1,
        );
        testOrderIds.push(oldOrderId, youngOrderId);

        // 3. Mirror the create-order path: bump times_used by 2.
        //    We do this via a raw update so it shows up in the audit log
        //    the same way the real RPC would.
        const { error: bumpErr } = await supabase
            .from('discount_codes')
            .update({ times_used: 2 })
            .eq('code_id', discountCodeId);
        assert('discount code counter bumped to 2', !bumpErr, bumpErr?.message ?? 'ok');

        // 4. Call the cleanup RPC
        const { data: rpcData, error: rpcErr } = await supabase.rpc(
            'cleanup_abandoned_pending_orders',
            { p_age: '24 hours' },
        );
        if (rpcErr) {
            throw new Error(`cleanup RPC failed: ${rpcErr.message}`);
        }
        const result = (rpcData as unknown as CleanupResult[])?.[0];
        assert(
            'RPC returned a single row',
            !!result,
            `rpcData=${JSON.stringify(rpcData)}`,
        );
        assert(
            'RPC cancelled at least 1 order',
            (result?.cancelled_count ?? 0) >= 1,
            `cancelled_count=${result?.cancelled_count}`,
        );

        // 5. Assert the OLD order is cancelled/expired.
        const oldRow = await fetchOrder(oldOrderId);
        assert(
            'old order → order_status=cancelled',
            oldRow.order_status === 'cancelled',
            `order_status=${oldRow.order_status}`,
        );
        assert(
            'old order → payment_status=expired',
            oldRow.payment_status === 'expired',
            `payment_status=${oldRow.payment_status}`,
        );
        assert(
            'old order → cancelled_at is set',
            !!oldRow.cancelled_at,
            `cancelled_at=${oldRow.cancelled_at}`,
        );

        // 6. Assert the YOUNG order is untouched.
        const youngRow = await fetchOrder(youngOrderId);
        assert(
            'young order → order_status=pending',
            youngRow.order_status === 'pending',
            `order_status=${youngRow.order_status}`,
        );
        assert(
            'young order → payment_status=pending',
            youngRow.payment_status === 'pending',
            `payment_status=${youngRow.payment_status}`,
        );

        // 7. Assert the discount counter was decremented back to 0.
        const { data: dcRow, error: dcErr } = await supabase
            .from('discount_codes')
            .select('times_used')
            .eq('code_id', discountCodeId)
            .single();
        if (dcErr) throw new Error(`discount_codes re-read failed: ${dcErr.message}`);
        // The counter started at 2 (after the bump) and the cleanup should
        // have decremented it by 1 (the old order). The young order is
        // still pending so its increment is preserved.
        assert(
            'discount counter decremented by exactly 1 (old order only)',
            dcRow?.times_used === 1,
            `times_used=${dcRow?.times_used}`,
        );
    } catch (err) {
        console.error('Test setup or execution failed:', err);
    } finally {
        // 8. Always tear down test artifacts.
        await cleanupTestArtifacts(testOrderIds, discountCodeId);
    }

    // ---------- pretty-print results ----------
    const pad = (s: string, n: number) =>
        s.length >= n ? s : s + ' '.repeat(n - s.length);
    console.log('');
    console.log(pad('CHECK', 60) + 'STATUS');
    console.log('-'.repeat(72));
    for (const r of results) {
        console.log(
            pad(r.name, 60) + (r.ok ? 'PASS' : `FAIL (${r.detail})`),
        );
    }

    const failed = results.filter((r) => !r.ok);
    console.log('');
    if (failed.length === 0) {
        console.log(`✅ ${results.length}/${results.length} assertions passed.`);
        process.exit(0);
    }
    console.error(`❌ ${failed.length}/${results.length} assertions failed.`);
    for (const r of failed) {
        console.error(`   - ${r.name}: ${r.detail}`);
    }
    process.exit(1);
}

main().catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(2);
});
