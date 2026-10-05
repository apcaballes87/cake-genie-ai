import { writeFile } from 'node:fs/promises';

const teamOrigin = process.argv[2];
if (!teamOrigin) throw new Error('Pass the exact Cloudflare Access team origin as the first argument.');
const issuer = new URL(teamOrigin);
if (issuer.protocol !== 'https:' || !issuer.hostname.endsWith('.cloudflareaccess.com') || issuer.origin !== teamOrigin) {
  throw new Error('Expected an HTTPS Cloudflare Access team origin.');
}

const response = await fetch(`${issuer.origin}/cdn-cgi/access/certs`, { redirect: 'error' });
if (!response.ok) throw new Error(`Cloudflare Access key refresh failed with HTTP ${response.status}.`);
const jwks = await response.json();
if (!Array.isArray(jwks.keys) || jwks.keys.length === 0 || jwks.keys.length > 10 ||
  jwks.keys.some(key => key.kty !== 'RSA' || key.alg !== 'RS256' || key.use !== 'sig' || !key.kid || !key.n || !key.e)) {
  throw new Error('Cloudflare returned an unexpected signing-key set.');
}

await writeFile(new URL('../access-jwks.json', import.meta.url), `${JSON.stringify(jwks)}\n`);
console.log(`Saved ${jwks.keys.length} public Access signing keys.`);
