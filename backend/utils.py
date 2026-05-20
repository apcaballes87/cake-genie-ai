import cv2
import numpy as np
import base64
import json
import requests

def normalize_orientation(image_np):
    """
    Normalizes image orientation if EXIF data is present.
    Since cv2.imdecode might not respect EXIF flags, we return the image as-is
    but ensure it's in a standard format.
    """
    # OpenCV standard loads as BGR
    return image_np

def preprocess_image(image_bytes, target_width=768):
    """
    Loads, normalizes, and resizes the image for feature processing.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image bytes, could not decode image.")
    
    img = normalize_orientation(img)
    
    # Resize long edge to target_width maintaining aspect ratio
    h, w = img.shape[:2]
    if max(h, w) > target_width:
        scale = target_width / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        
    return img

def compute_average_hash(gray_img, size=8):
    """
    Computes an average hash (aHash) for a grayscale image.
    """
    resized = cv2.resize(gray_img, (size, size), interpolation=cv2.INTER_AREA)
    avg = resized.mean()
    bits = (resized > avg).flatten()
    
    # Convert bits to 16-character hex string
    hash_val = 0
    for i, bit in enumerate(bits):
        if bit:
            hash_val |= (1 << i)
    return f"{hash_val:016x}"

def compute_global_p_hash(image):
    """
    Computes a global perceptual average hash for the whole image.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return compute_average_hash(gray)

def compute_tile_p_hash(image, grid_size=4, tile_size=64):
    """
    Divides the image into a grid of tiles (e.g. 4x4) and computes a pHash for each tile.
    This provides high crop resistance since unaffected tiles will still match.
    """
    # Resize image to a standard square grid
    std_size = grid_size * tile_size # 4 * 64 = 256
    resized = cv2.resize(image, (std_size, std_size), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    
    tile_hashes = []
    for r in range(grid_size):
        for c in range(grid_size):
            y_start = r * tile_size
            x_start = c * tile_size
            tile = gray[y_start:y_start + tile_size, x_start:x_start + tile_size]
            tile_hashes.append(compute_average_hash(tile))
            
    return tile_hashes

def extract_orb_features(image, max_features=1500):
    """
    Extracts ORB keypoints and descriptors from a normalized BGR image.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    orb = cv2.ORB_create(nfeatures=max_features)
    keypoints, descriptors = orb.detectAndCompute(gray, None)
    return keypoints, descriptors

def serialize_features(keypoints, descriptors):
    """
    Serializes keypoints coordinates and descriptors to a JSON-safe string.
    """
    if descriptors is None or len(descriptors) == 0:
        return json.dumps({"keypoints": [], "descriptors": ""})
    
    kp_coords = [[kp.pt[0], kp.pt[1]] for kp in keypoints]
    desc_b64 = base64.b64encode(descriptors.tobytes()).decode('utf-8')
    
    return json.dumps({
        "keypoints": kp_coords,
        "descriptors": desc_b64
    })

def deserialize_features(features_str):
    """
    Deserializes a features JSON string back to raw coordinates and numpy descriptors.
    """
    if not features_str:
        return [], None
        
    try:
        data = json.loads(features_str)
        kp_coords = data.get("keypoints", [])
        desc_b64 = data.get("descriptors", "")
        
        if not desc_b64:
            return kp_coords, None
            
        desc_bytes = base64.b64decode(desc_b64)
        descriptors = np.frombuffer(desc_bytes, dtype=np.uint8).reshape(-1, 32)
        return kp_coords, descriptors
    except Exception as e:
        print(f"Error deserializing features: {e}")
        return [], None

def verify_match(query_kps, query_desc, db_kp_coords, db_desc, thresholds):
    """
    Compares query descriptors against database descriptors using BFMatcher + RANSAC homography.
    """
    if query_desc is None or db_desc is None or len(query_desc) < 4 or len(db_desc) < 4:
        return False, 0.0, 0, 0, 0.0, None

    bf = cv2.BFMatcher(cv2.NORM_HAMMING)
    try:
        # Find 2 best matches for Lowe's ratio test
        matches = bf.knnMatch(query_desc, db_desc, k=2)
    except Exception as e:
        print(f"KNN Match failed: {e}")
        return False, 0.0, 0, 0, 0.0, None

    good_matches = []
    for m_n in matches:
        if len(m_n) == 2:
            m, n = m_n
            if m.distance < 0.75 * n.distance:
                good_matches.append(m)
        elif len(m_n) == 1:
            # Fallback if only 1 match found
            good_matches.append(m_n[0])

    good_count = len(good_matches)
    if good_count < thresholds["min_good_matches"]:
        return False, 0.0, good_count, 0, 0.0, good_matches

    # Extract coordinates for homography
    src_pts = np.float32([query_kps[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
    dst_pts = np.float32([db_kp_coords[m.trainIdx] for m in good_matches]).reshape(-1, 1, 2)

    try:
        # Run findHomography with RANSAC
        M, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
        if mask is not None:
            inliers = mask.ravel().tolist()
            ransac_inliers = sum(inliers)
            inlier_ratio = ransac_inliers / good_count if good_count > 0 else 0.0
        else:
            ransac_inliers = 0
            inlier_ratio = 0.0
            inliers = []
    except Exception as e:
        print(f"RANSAC Homography failed: {e}")
        ransac_inliers = 0
        inlier_ratio = 0.0
        inliers = []

    # Decide match
    is_match = (ransac_inliers >= thresholds["min_ransac_inliers"]) and (inlier_ratio >= thresholds["min_inlier_ratio"])
    
    # Calculate match confidence
    confidence = 0.0
    if is_match:
        # Scale inlier ratio and inlier count to a 0.0 - 1.0 confidence score
        confidence = min(1.0, (ransac_inliers / 30.0) * 0.7 + inlier_ratio * 0.3)
        
    return is_match, confidence, good_count, ransac_inliers, inlier_ratio, inliers

def draw_visual_matches(query_img, query_kps, db_img_url, db_kp_coords, good_matches, inliers_mask=None):
    """
    Downloads the database image and draws the matching keypoints connected by lines.
    """
    db_img = None
    if db_img_url:
        try:
            resp = requests.get(db_img_url, timeout=4)
            if resp.status_code == 200:
                db_arr = np.asarray(bytearray(resp.content), dtype=np.uint8)
                db_img = cv2.imdecode(db_arr, cv2.IMREAD_COLOR)
        except Exception as e:
            print(f"Failed to download reference image for visualization: {e}")

    # Fallback to a placeholder blank BGR image if we can't load the database image
    if db_img is None:
        h, w = query_img.shape[:2]
        db_img = np.zeros((h, w, 3), dtype=np.uint8)
        # Draw placeholder text
        cv2.putText(db_img, "Image Not Loaded", (w // 6, h // 2), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

    # Recreate keypoint objects for database image
    db_kps = [cv2.KeyPoint(x=pt[0], y=pt[1], size=1.0) for pt in db_kp_coords]

    # Convert query to BGR if grayscale
    if len(query_img.shape) == 2:
        query_img_bgr = cv2.cvtColor(query_img, cv2.COLOR_GRAY2BGR)
    else:
        query_img_bgr = query_img.copy()

    # Align height of both images for clean rendering
    h_q, w_q = query_img_bgr.shape[:2]
    h_d, w_d = db_img.shape[:2]
    if h_q != h_d:
        new_h = max(h_q, h_d)
        padded_query = np.zeros((new_h, w_q, 3), dtype=np.uint8)
        padded_query[:h_q, :w_q] = query_img_bgr
        query_img_bgr = padded_query
        
        padded_db = np.zeros((new_h, w_d, 3), dtype=np.uint8)
        padded_db[:h_d, :w_d] = db_img
        db_img = padded_db

    # Draw lines
    out_img = cv2.drawMatches(
        query_img_bgr, query_kps,
        db_img, db_kps,
        good_matches, None,
        matchesMask=inliers_mask,
        flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS,
        matchColor=(0, 255, 0), # Green lines for inlier matches
        singlePointColor=(0, 0, 255)
    )

    _, encoded = cv2.imencode('.jpg', out_img)
    b64_str = base64.b64encode(encoded).decode('utf-8')
    return f"data:image/jpeg;base64,{b64_str}"
