import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

const PUBLIC_BUILD_NAMES = [
  'NEXT_PUBLIC_CREATOR_APPLICATIONS_OPEN',
  'NEXT_PUBLIC_GOOGLE_AI_API_KEY',
  'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
  'NEXT_PUBLIC_PINTEREST_APP_ID',
  'NEXT_PUBLIC_ROBOFLOW_API_KEY',
  'NEXT_PUBLIC_ROBOFLOW_CONFIDENCE',
  'NEXT_PUBLIC_ROBOFLOW_FALLBACK',
  'NEXT_PUBLIC_ROBOFLOW_WORKFLOW_ID',
  'NEXT_PUBLIC_ROBOFLOW_WORKSPACE',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_USE_NEW_PRICING',
];
const REQUIRED_BUILD_NAMES = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
];

const target = process.argv[2];
if (target !== 'staging' && target !== 'production') {
  throw new Error('Usage: node scripts/prepare-cloudflare-config.mjs staging|production [public-env-file]');
}

const sourceFile = process.argv[3];
const fileValues = sourceFile ? dotenv.parse(readFileSync(resolve(sourceFile))) : {};
const publicValues = Object.fromEntries(
  PUBLIC_BUILD_NAMES.flatMap((name) => {
    const value = process.env[name] || fileValues[name];
    return value ? [[name, value]] : [];
  }),
);
const missing = REQUIRED_BUILD_NAMES.filter((name) => !publicValues[name]);
if (missing.length) throw new Error(`Missing public build variables: ${missing.join(', ')}`);

const siteUrl = new URL(publicValues.NEXT_PUBLIC_SITE_URL);
if (siteUrl.protocol !== 'https:' || siteUrl.origin !== publicValues.NEXT_PUBLIC_SITE_URL) {
  throw new Error('NEXT_PUBLIC_SITE_URL must be an HTTPS origin with no path, query, or fragment');
}
if (target === 'staging' && !/^genieph-container-staging\.[^.]+\.workers\.dev$/.test(siteUrl.hostname)) {
  throw new Error('Staging NEXT_PUBLIC_SITE_URL must be the genieph-container-staging workers.dev origin');
}

const config = JSON.parse(readFileSync(resolve('wrangler.jsonc'), 'utf8'));
const selected = target === 'production' ? config.env.production : config;
selected.containers[0].image_vars = publicValues;
selected.vars = publicValues;

const outputPath = resolve(`wrangler.${target}.generated.jsonc`);
writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
console.log(`Prepared ${outputPath} with ${Object.keys(publicValues).length} public build variable names.`);
