# Fix Gemini Service Syntax Errors

**Copy this to Qwen:**

```
URGENT: Fix syntax errors in geminiService.ts

PROBLEM:
There are orphaned code fragments (old schema definitions) causing compilation errors in src/services/geminiService.ts around lines 1105+. These references use undefined constants like OBJECT, STRING, etc.

SOLUTION:

1. Open file: /Users/apcaballes/genieph/src/services/geminiService.ts

2. Search for any remaining lines that reference these undefined constants:
   - OBJECT
   - STRING
   - ARRAY
   - NUMBER
   - INTEGER
   - BOOLEAN

3. These are likely around lines 1100-1200 and look like:
   ```
   type: OBJECT,
   properties: {
     something: { type: STRING, enum: [...] }
   }
   ```

4. DELETE all orphaned schema code that references these undefined constants

5. Make sure the file structure is clean:
   - Prompt constants (VALIDATION_PROMPT, FALLBACK_PROMPT, etc.) should end with closing backtick and semicolon
   - Functions should start right after the constants
   - No floating object properties between sections

6. After cleaning up, verify the file:
   - Run: npm run dev
   - Check that it compiles without errors
   - The error should mention specific line numbers - delete those lines

7. The file should have this structure:
   ```
   import statements
   ↓
   constants (geminiApiKey, genAI, supabase)
   ↓
   prompt cache functions
   ↓
   utility functions (arrayBufferToBase64, fileToBase64)
   ↓
   VALIDATION_PROMPT constant
   ↓
   validateCakeImage function
   ↓
   SYSTEM_INSTRUCTION constant
   ↓
   FALLBACK_PROMPT constant
   ↓
   analyzeCakeImage function
   ↓
   other functions
   ```

8. There should be NO orphaned object properties floating between constants and functions

SUCCESS CRITERIA:
- npm run dev starts without syntax errors
- No "Cannot find name 'OBJECT'" or similar errors
- File compiles cleanly

Report back with what you deleted and confirm dev server starts successfully.
```
