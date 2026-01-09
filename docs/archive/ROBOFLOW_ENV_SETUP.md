# Roboflow + Florence-2 Environment Variables

# Add these to your .env.local file

# ==========================================

# ROBOFLOW SERVERLESS CONFIGURATION

# ==========================================

# Your Roboflow API Key

# Get from: <https://app.roboflow.com/settings/api>

VITE_ROBOFLOW_API_KEY=YovL************psm

# Your Roboflow workspace name

VITE_ROBOFLOW_WORKSPACE=genieph

# Optional: Specific workflow ID for Florence-2

# VITE_ROBOFLOW_WORKFLOW_ID=playground-

# ==========================================

# FEATURE FLAGS

# ==========================================

# Enable Roboflow for coordinate detection (false = use Gemini)

VITE_USE_ROBOFLOW=false

# Minimum confidence threshold for detections (0.0-1.0)

VITE_ROBOFLOW_CONFIDENCE=0.3

# Fallback to Gemini if Roboflow fails (true = safe fallback)

VITE_ROBOFLOW_FALLBACK=true

# Enable debug logging for Roboflow

VITE_DEBUG_ROBOFLOW=false

# ==========================================

# EXISTING VARIABLES (keep unchanged)

# ==========================================

# Gemini API Key (keep as fallback)

# VITE_GEMINI_API_KEY=your_existing_key
