import os
import time
import cv2
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv
from supabase import create_client, Client

# Import local CV utilities
from utils import (
    preprocess_image,
    compute_global_p_hash,
    compute_tile_p_hash,
    extract_orb_features,
    serialize_features,
    deserialize_features,
    verify_match,
    draw_visual_matches
)

# Load environment variables
load_dotenv()
# Also try to load .env.local if present
load_dotenv(dotenv_path="../.env.local")

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")

_supabase_client: Optional[Client] = None
_supabase_last_error: Optional[str] = None


def get_supabase() -> Optional[Client]:
    """Return a connected Supabase client. Lazy-inits and retries on each call."""
    global _supabase_client, _supabase_last_error

    if _supabase_client is not None:
        return _supabase_client

    url = SUPABASE_URL
    key = SUPABASE_KEY
    if not url or not key:
        _supabase_last_error = "Missing SUPABASE_URL or SUPABASE_KEY"
        print(f"❌ {_supabase_last_error}")
        return None

    try:
        _supabase_client = create_client(url, key)
        _supabase_last_error = None
        print("✅ Connected to Supabase successfully.")
        return _supabase_client
    except Exception as e:
        _supabase_last_error = str(e)
        print(f"❌ Failed to initialize Supabase client: {e}")
        return None


def get_supabase_or_raise() -> Client:
    """Return a Supabase client or raise 503 if unavailable."""
    client = get_supabase()
    if client is None:
        raise HTTPException(
            status_code=503,
            detail=f"Database unavailable — {_supabase_last_error or 'check server logs'}"
        )
    return client

app = FastAPI(title="Genie Cropped-Image Similarity Detection System", version="1.0.0")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Match thresholds configurations
THRESHOLDS = {
    "default": {
        "min_good_matches": 30,
        "min_ransac_inliers": 18,
        "min_inlier_ratio": 0.25
    },
    "strict": {
        "min_good_matches": 35,
        "min_ransac_inliers": 30,
        "min_inlier_ratio": 0.35
    },
    "loose": {
        "min_good_matches": 20,
        "min_ransac_inliers": 12,
        "min_inlier_ratio": 0.20
    }
}

class ConfigUpdateRequest(BaseModel):
    mode: str
    min_good_matches: Optional[int] = None
    min_ransac_inliers: Optional[int] = None
    min_inlier_ratio: Optional[float] = None

# Cache indexed count — refreshed every 60s to avoid COUNT(*) timeout on large tables
_indexed_count_cache: dict = {"value": 0, "last_fetched": 0.0}

def _get_indexed_count() -> int:
    client = get_supabase()
    if client is None:
        return 0
    now = time.time()
    if now - _indexed_count_cache["last_fetched"] < 60:
        return _indexed_count_cache["value"]
    try:
        count_res = client.table("cakegenie_image_features").select("id", count="exact").limit(0).execute()
        count = count_res.count or 0
        _indexed_count_cache["value"] = count
        _indexed_count_cache["last_fetched"] = now
        return count
    except Exception:
        return _indexed_count_cache["value"]

@app.get("/api/status")
def get_status():
    db_status = "Disconnected"
    indexed_count = 0

    client = get_supabase()
    if client:
        try:
            indexed_count = _get_indexed_count()
            db_status = "Connected"
        except Exception as e:
            db_status = f"Error: {e}"

    return {
        "status": "online",
        "database": db_status,
        "indexed_images": indexed_count,
        "current_thresholds": THRESHOLDS["default"]
    }

@app.post("/api/config")
def update_config(payload: ConfigUpdateRequest):
    if payload.mode not in THRESHOLDS:
        raise HTTPException(status_code=400, detail="Invalid mode. Must be 'default', 'strict', or 'loose'.")
        
    mode = payload.mode
    if payload.min_good_matches is not None:
        THRESHOLDS[mode]["min_good_matches"] = payload.min_good_matches
    if payload.min_ransac_inliers is not None:
        THRESHOLDS[mode]["min_ransac_inliers"] = payload.min_ransac_inliers
    if payload.min_inlier_ratio is not None:
        THRESHOLDS[mode]["min_inlier_ratio"] = payload.min_inlier_ratio
        
    return {"message": f"Thresholds updated for {mode}", "thresholds": THRESHOLDS[mode]}

@app.post("/api/match")
async def match_image(
    file: UploadFile = File(...),
    mode: str = Query("default", enum=["default", "strict", "loose"]),
    visualize: bool = Query(True)
):
    """
    Matches an uploaded query image against the indexed cache database.
    Flow:
    1. Preprocess and normalize query image.
    2. Compute 16 tile-based pHashes.
    3. Query Supabase RPC `find_candidates_by_tile_hash` to filter candidates.
    4. Extract ORB descriptors from query.
    5. Run ORB + RANSAC verification on candidates.
    6. Return match result, confidence, stats, and visualization base64.
    """
    supabase = get_supabase_or_raise()
        
    start_time = time.time()
    
    # 1. Load and preprocess the uploaded file
    try:
        content = await file.read()
        print(f"\n[DEBUG] === New Match Request ===")
        print(f"[DEBUG] Incoming file: name={file.filename}, size={len(content)} bytes, content_type={file.content_type}")
        img = preprocess_image(content, target_width=768)
        print(f"[DEBUG] Preprocessed image dimensions: {img.shape}")
    except Exception as e:
        print(f"[DEBUG] Preprocessing failed: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to process uploaded image: {e}")

    # 2. Compute hashes
    query_global_hash = compute_global_p_hash(img)
    query_tile_hashes = compute_tile_p_hash(img)
    print(f"[DEBUG] Computed Global pHash: {query_global_hash}")
    print(f"[DEBUG] Computed 16 Tile pHashes: {query_tile_hashes}")
    
    # 3. Retrieve candidates using a two-tier global pHash pre-filter strategy.
    # - Tier 1 (fast): tight global pHash threshold (dist <= 10) → typically <30 candidates
    # - Tier 2 (fallback): loosen to dist <= 24 only if tier 1 finds nothing
    # This prevents timeout when images (e.g., white cakes) share a similar global pHash
    # with thousands of DB entries, causing massive CROSS JOIN blowout at dist <= 24.
    
    def _query_candidates(global_phash_max_dist: int) -> list:
        try:
            print(f"[DEBUG] Querying RPC with global_phash_max_dist={global_phash_max_dist}...")
            res = supabase.rpc("find_candidates_by_tile_hash", {
                "query_global_hash": query_global_hash,
                "query_hashes": query_tile_hashes,
                "max_hamming_dist": 6,
                "min_matching_tiles": 3,
                "max_limit": 30,
                "global_phash_max_dist": global_phash_max_dist
            }).execute()
            result = res.data or []
            print(f"[DEBUG] RPC(dist<={global_phash_max_dist}) returned {len(result)} candidates.")
            for idx, cand in enumerate(result):
                print(f"  - Candidate {idx+1}: ID={cand.get('id')}, match_count={cand.get('match_count')}, avg_dist={cand.get('avg_dist')}")
            return result
        except Exception as e:
            print(f"[DEBUG] RPC(dist<={global_phash_max_dist}) failed: {e}")
            return []

    # Tier 1: tight pre-filter (fast — only hits near-identical global pHashes)
    candidates = _query_candidates(10)
    
    # Tier 2: relax if tight pre-filter found nothing (handles crop/resize cases)
    if not candidates:
        print("[DEBUG] Tier 1 (dist<=10) found nothing. Falling back to Tier 2 (dist<=24)...")
        candidates = _query_candidates(24)
        
    # If still zero candidates, return no-match immediately
    if not candidates:
        duration = (time.time() - start_time) * 1000
        print(f"[DEBUG] Both tiers exhausted. No candidates found. Speed: {duration:.2f} ms")
        return {
            "match": False,
            "confidence": 0.0,
            "good_matches": 0,
            "ransac_inliers": 0,
            "inlier_ratio": 0.0,
            "matched_image_id": None,
            "matched_image_url": None,
            "analysis_json": None,
            "candidates_evaluated": 0,
            "execution_time_ms": duration
        }


    # 4. Extract ORB features of the query image for detailed verification
    print(f"[DEBUG] Extracting query ORB features...")
    query_kps, query_desc = extract_orb_features(img)
    print(f"[DEBUG] Extracted {len(query_kps)} query keypoints.")
    
    # Retrieve DB feature rows for candidates
    candidate_ids = [c["id"] for c in candidates]
    try:
        print(f"[DEBUG] Fetching candidate DB features for IDs: {candidate_ids}")
        feat_res = supabase.table("cakegenie_image_features").select("*").in_("id", candidate_ids).execute()
        db_features = feat_res.data or []
        print(f"[DEBUG] Retrieved features for {len(db_features)} candidates from database.")
    except Exception as e:
        print(f"[DEBUG] Failed to fetch features: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch features: {e}")

    # 5. Run ORB + RANSAC verification on candidates
    winner = None
    winner_stats = {}
    winner_inliers_mask = None
    
    thresholds = THRESHOLDS[mode]
    print(f"[DEBUG] Matching mode: {mode}, thresholds: {thresholds}")
    
    # Map candidates for quick distance lookup
    candidate_score_map = {c["id"]: c for c in candidates}
    
    # Order DB features to match the RPC output relevance ordering
    db_features_sorted = sorted(
        db_features,
        key=lambda x: candidate_score_map.get(x["id"], {}).get("matching_tiles_count", 0),
        reverse=True
    )
 
    for idx, item in enumerate(db_features_sorted):
        db_id = item["id"]
        db_orb_data = item.get("orb_descriptors")
        
        if not db_orb_data:
            print(f"  - Candidate {idx+1} (ID={db_id}): No ORB descriptors in DB record.")
            continue
            
        db_kp_coords, db_desc = deserialize_features(db_orb_data)
        
        # Verify feature matching
        is_match, conf, good_c, ransac_i, inlier_r, inliers = verify_match(
            query_kps, query_desc,
            db_kp_coords, db_desc,
            thresholds
        )
        
        print(f"  - Candidate {idx+1} (ID={db_id}): verified={is_match}, confidence={conf:.2f}, good={good_c}, ransac={ransac_i}, ratio={inlier_r:.2f}")
        
        if is_match:
            # Found a verified match! Keep the highest confidence one.
            if winner is None or conf > winner_stats.get("confidence", 0.0):
                winner = item
                winner_stats = {
                    "confidence": round(conf, 2),
                    "good_matches": good_c,
                    "ransac_inliers": ransac_i,
                    "inlier_ratio": round(inlier_r, 2)
                }
                winner_inliers_mask = inliers
                # Optimization: if confidence is extremely high, break early!
                if conf > 0.90:
                    print(f"    -> High confidence match found. Breaking early.")
                    break

    # If we found a verified match, fetch complete analysis result
    matched_image_url = None
    analysis_json = None
    drawn_matches_b64 = None
    cache_p_hash = None
    cache_metadata = None
    
    if winner:
        winner_id = winner["id"]
        print(f"[DEBUG] Winner found: ID={winner_id}, stats={winner_stats}")
        try:
            cache_res = (
                supabase.table("cakegenie_analysis_cache")
                .select("p_hash, seo_title, seo_description, keywords, alt_text, slug, original_image_url, price, availability, analysis_json")
                .eq("id", winner_id)
                .single()
                .execute()
            )
            if cache_res.data:
                cache_p_hash = cache_res.data.get("p_hash")
                matched_image_url = cache_res.data.get("original_image_url")
                analysis_json = cache_res.data.get("analysis_json")
                cache_metadata = {
                    "seo_title": cache_res.data.get("seo_title"),
                    "seo_description": cache_res.data.get("seo_description"),
                    "keywords": cache_res.data.get("keywords"),
                    "alt_text": cache_res.data.get("alt_text"),
                    "slug": cache_res.data.get("slug"),
                    "original_image_url": matched_image_url,
                    "price": cache_res.data.get("price"),
                    "availability": cache_res.data.get("availability"),
                }
                print(f"[DEBUG] Retrieved metadata: url={matched_image_url}")
        except Exception as e:
            print(f"Failed to fetch cached analysis metadata: {e}")
            
        # Draw keypoint alignment visual
        if visualize and matched_image_url:
            # Filter matches list for drawMatches
            # Recompute matches to get list of GoodMatches objects for drawing
            bf = cv2.BFMatcher(cv2.NORM_HAMMING)
            try:
                db_kp_coords, db_desc = deserialize_features(winner["orb_descriptors"])
                matches = bf.knnMatch(query_desc, db_desc, k=2)
                good_matches = []
                for m_n in matches:
                    if len(m_n) == 2 and m_n[0].distance < 0.75 * m_n[1].distance:
                        good_matches.append(m_n[0])
                    elif len(m_n) == 1:
                        good_matches.append(m_n[0])
                        
                # Keep only verified good matches up to good_c count
                drawn_matches_b64 = draw_visual_matches(
                    img, query_kps,
                    matched_image_url, db_kp_coords,
                    good_matches, winner_inliers_mask
                )
                print(f"[DEBUG] Keypoint matches visual drawn successfully.")
            except Exception as draw_err:
                print(f"Error drawing matches visual: {draw_err}")
    else:
        print("[DEBUG] Match failed: None of the candidates passed verification thresholds.")

    duration = (time.time() - start_time) * 1000
    print(f"[DEBUG] Match request complete. Total execution time: {duration:.2f} ms")
    
    if winner:
        return {
            "match": True,
            "confidence": winner_stats["confidence"],
            "good_matches": winner_stats["good_matches"],
            "ransac_inliers": winner_stats["ransac_inliers"],
            "inlier_ratio": winner_stats["inlier_ratio"],
            "matched_image_id": winner["id"],
            "matched_image_url": matched_image_url,
            "analysis_json": analysis_json,
            "cache_p_hash": cache_p_hash,
            "cache_metadata": cache_metadata,
            "drawn_matches_b64": drawn_matches_b64,
            "candidates_evaluated": len(candidates),
            "execution_time_ms": round(duration, 2)
        }
    else:
        return {
            "match": False,
            "confidence": 0.0,
            "good_matches": 0,
            "ransac_inliers": 0,
            "inlier_ratio": 0.0,
            "matched_image_id": None,
            "matched_image_url": None,
            "analysis_json": None,
            "cache_p_hash": None,
            "cache_metadata": None,
            "drawn_matches_b64": None,
            "candidates_evaluated": len(candidates),
            "execution_time_ms": round(duration, 2)
        }

@app.post("/api/index")
async def index_image(
    cache_id: str = Form(...),
    skip_if_exists: bool = Form(False),
    file: UploadFile = File(...)
):
    """
    Computes and saves features (Global pHash, Tile-based pHashes, ORB descriptors)
    for a newly uploaded image, linking it to its `cakegenie_analysis_cache` id.
    """
    supabase = get_supabase_or_raise()

    if skip_if_exists:
        try:
            existing = (
                supabase.table("cakegenie_image_features")
                .select("id")
                .eq("id", cache_id)
                .limit(1)
                .execute()
            )
            if existing.data and len(existing.data) > 0:
                return {
                    "success": True,
                    "already_indexed": True,
                    "message": "Image features already indexed for this cache row.",
                    "data": existing.data,
                }
        except Exception as lookup_err:
            print(f"[DEBUG] Existing feature lookup failed for cache_id={cache_id}: {lookup_err}")
        
    try:
        content = await file.read()
        img = preprocess_image(content, target_width=768)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process image: {e}")
        
    try:
        # Compute hashes and features
        global_hash = compute_global_p_hash(img)
        tile_hashes = compute_tile_p_hash(img)
        kps, desc = extract_orb_features(img)
        serialized = serialize_features(kps, desc)
        
        # Save to database
        db_payload = {
            "id": cache_id,
            "global_phash": global_hash,
            "tile_phash": tile_hashes,
            "orb_descriptors": serialized
        }
        
        res = supabase.table("cakegenie_image_features").upsert(db_payload).execute()
        return {"success": True, "message": "Image features successfully indexed.", "data": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Indexing failed: {e}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
