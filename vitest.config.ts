import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/tests/setup.ts',
        // tests/visibility.test.js is a console.log stub from an old debug
        // session — vitest correctly flags it as 'no test suite found'.
        // Excluded here so it doesn't fail every CI run. If you want a
        // real visibility test, write it in tests/visibility.test.ts
        // (vitest will pick it up automatically once it has describe/it).
        exclude: [
            '**/node_modules/**',
            '**/.next/**',
            '**/.claude/**',
            '**/dist/**',
            '**/tests/visibility.test.js',
        ],
        // Default 5s timeout occasionally trips CPU-bound property tests
        // (e.g. image-variants sharp encode) under full-suite load. Bump
        // to 15s globally so the suite isn't at the mercy of wall-clock.
        testTimeout: 15_000,
        // A few tests are wall-clock-sensitive even with a generous
        // timeout (e.g. fast-check property tests that involve sharp
        // encode/decode, or tests that interact with the full test
        // pool's mock-chain setup). Retry up to 2 times before
        // reporting a failure. This is a *last resort* — if a test
        // is genuinely flaky, fix the test, don't lean on retry.
        retry: process.env.CI ? 2 : 0,
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
