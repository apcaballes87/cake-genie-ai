"""
sync_features.py — Full-sync script for Genie Similarity Index

Indexes ALL images from cakegenie_analysis_cache into cakegenie_image_features.
- Uses pagination to handle 10k+ rows without missing any
- Parallel workers (configurable) for faster throughput
- Skips already-indexed images (safe to re-run / resume)
- Detailed progress output with ETA
"""

import os
import sys
import time
import requests
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
from supabase import create_client, Client

from utils import (
    preprocess_image,
    compute_global_p_hash,
    compute_tile_p_hash,
    extract_orb_features,
    serialize_features,
)

load_dotenv()
load_dotenv(dotenv_path="../.env.local")

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Supabase credentials not found in environment. Exiting.")
    sys.exit(1)

# --- Config ---
PAGE_SIZE      = 200    # rows per DB page fetch
WORKER_THREADS = 4      # parallel image processing threads
REQUEST_TIMEOUT = 15    # seconds per image download

# Thread-local Supabase client (one per worker thread to avoid shared state)
_thread_local = threading.local()

def get_supabase() -> Client:
    if not hasattr(_thread_local, "client"):
        _thread_local.client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _thread_local.client


# --- Fetch all unindexed IDs via pagination ---

def fetch_all_unindexed() -> list[dict]:
    """
    Pages through ALL of cakegenie_analysis_cache and returns records
    whose IDs do not yet exist in cakegenie_image_features.
    Uses offset-based pagination so no records are missed.
    """
    main_sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("🔍 Loading already-indexed IDs from cakegenie_image_features...")
    indexed_ids: set[str] = set()
    feat_offset = 0
    while True:
        res = (
            main_sb.table("cakegenie_image_features")
            .select("id")
            .range(feat_offset, feat_offset + PAGE_SIZE - 1)
            .execute()
        )
        batch = res.data or []
        if not batch:
            break
        for row in batch:
            indexed_ids.add(row["id"])
        feat_offset += len(batch)
        if len(batch) < PAGE_SIZE:
            break

    print(f"✅ {len(indexed_ids)} images already indexed. Scanning cache for unindexed...")

    unindexed: list[dict] = []
    cache_offset = 0
    total_scanned = 0

    while True:
        res = (
            main_sb.table("cakegenie_analysis_cache")
            .select("id, original_image_url")
            .not_.is_("original_image_url", "null")
            .neq("original_image_url", "")
            .range(cache_offset, cache_offset + PAGE_SIZE - 1)
            .execute()
        )
        batch = res.data or []
        if not batch:
            break

        for row in batch:
            total_scanned += 1
            if row["id"] not in indexed_ids:
                unindexed.append(row)

        cache_offset += len(batch)
        print(f"  Scanned {cache_offset} rows | Found {len(unindexed)} unindexed so far...", end="\r")

        if len(batch) < PAGE_SIZE:
            break

    print(f"\n📦 Total scanned: {total_scanned} | Unindexed to process: {len(unindexed)}")
    return unindexed


# --- Index a single record ---

def index_record(record: dict) -> tuple[bool, str, float]:
    """
    Downloads, processes, and upserts a single image's features.
    Returns (success, record_id, elapsed_seconds).
    """
    record_id = record["id"]
    img_url   = record["original_image_url"]
    start     = time.time()

    try:
        resp = requests.get(img_url, timeout=REQUEST_TIMEOUT)
        if resp.status_code != 200:
            print(f"  ⚠️  HTTP {resp.status_code} for {record_id} — skipping")
            return False, record_id, time.time() - start

        img            = preprocess_image(resp.content, target_width=768)
        global_hash    = compute_global_p_hash(img)
        tile_hashes    = compute_tile_p_hash(img)
        kps, desc      = extract_orb_features(img)
        serialized     = serialize_features(kps, desc)

        payload = {
            "id":             record_id,
            "global_phash":   global_hash,
            "tile_phash":     tile_hashes,
            "orb_descriptors": serialized,
        }
        get_supabase().table("cakegenie_image_features").upsert(payload).execute()

        return True, record_id, time.time() - start

    except requests.exceptions.Timeout:
        print(f"  ⏱️  Timeout for {record_id} — skipping")
        return False, record_id, time.time() - start
    except Exception as e:
        print(f"  ❌ Error for {record_id}: {e}")
        return False, record_id, time.time() - start


# --- Main ---

def main():
    print("=" * 60)
    print("🚀 Genie Full Feature Sync — All Cache Images")
    print("=" * 60)

    unindexed = fetch_all_unindexed()

    if not unindexed:
        print("🎉 All images are already indexed! Nothing to do.")
        return

    total       = len(unindexed)
    success_n   = 0
    fail_n      = 0
    done_n      = 0
    start_time  = time.time()

    print(f"\n⚙️  Starting parallel indexing with {WORKER_THREADS} workers...\n")

    with ThreadPoolExecutor(max_workers=WORKER_THREADS) as executor:
        futures = {executor.submit(index_record, rec): rec for rec in unindexed}

        for future in as_completed(futures):
            success, record_id, elapsed = future.result()
            done_n += 1

            if success:
                success_n += 1
            else:
                fail_n += 1

            # Progress line
            pct        = done_n / total * 100
            elapsed_total = time.time() - start_time
            rate       = done_n / elapsed_total if elapsed_total > 0 else 0
            remaining  = (total - done_n) / rate if rate > 0 else 0
            status_sym = "✅" if success else "❌"
            print(
                f"  {status_sym} [{done_n}/{total}] {pct:.1f}% | "
                f"{rate:.1f} img/s | ETA {remaining:.0f}s | "
                f"id={record_id[:8]}... ({elapsed:.2f}s)"
            )

    total_elapsed = time.time() - start_time
    print("\n" + "=" * 60)
    print(f"✅ Sync complete!")
    print(f"   Total processed : {done_n}")
    print(f"   Successful       : {success_n}")
    print(f"   Failed / skipped : {fail_n}")
    print(f"   Time elapsed     : {total_elapsed:.1f}s ({total_elapsed/60:.1f}m)")
    avg_rate = done_n / total_elapsed if total_elapsed > 0 else 0
    print(f"   Avg throughput   : {avg_rate:.1f} images/sec")
    print("=" * 60)


if __name__ == "__main__":
    main()
