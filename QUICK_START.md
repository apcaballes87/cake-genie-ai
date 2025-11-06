# Quick Start: Fix API Key Issue

## 🚨 Problem
Your Gemini API key was reported as leaked and is no longer valid.

## 🛠️ Quick Fix (5 minutes)

### 1. Get New API Key
1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API key"
3. Copy the new key

### 2. Update Configuration
1. Open [.env.local](file:///Users/apcaballes/genieph/.env.local)
2. Replace `REPLACE_WITH_YOUR_NEW_GEMINI_API_KEY` with your new key
3. Save the file

### 3. Verify It Works
```bash
node verify-api-key.mjs
```

Expected output:
```
✅ SUCCESS: API key is valid and working!
```

### 4. Test Application
```bash
npm run dev
```
Then test the cake image upload feature in your browser.

## 📚 Next Steps
- [IMMEDIATE_ACTION_CHECKLIST.md](file:///Users/apcaballes/genieph/IMMEDIATE_ACTION_CHECKLIST.md) - Detailed checklist
- [PRE_IMPORT_CHECKLIST.md](file:///Users/apcaballes/genieph/PRE_IMPORT_CHECKLIST.md) - Before importing updated app
- [IMPORT_PLAN.md](file:///Users/apcaballes/genieph/IMPORT_PLAN.md) - How to safely import from AI Studio

## ❓ Need Help?
Check [ISSUES_AND_SOLUTIONS.md](file:///Users/apcaballes/genieph/ISSUES_AND_SOLUTIONS.md) for detailed technical information.