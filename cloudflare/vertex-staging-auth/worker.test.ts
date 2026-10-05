// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest';
import broker, { verifyAccessToken } from './worker';

const config = {
  ACCESS_TEAM_DOMAIN: 'https://staging-team.cloudflareaccess.com',
  ACCESS_AUDIENCE: 'staging-app-audience',
  ACCESS_SERVICE_TOKEN_ID: 'staging-service.access',
};
let pair: CryptoKeyPair;
let publicKey: JsonWebKey;
const now = 1700000000;
const claims = { iss: config.ACCESS_TEAM_DOMAIN, aud: [config.ACCESS_AUDIENCE], type: 'app',
  common_name: config.ACCESS_SERVICE_TOKEN_ID, sub: '', iat: now - 5, exp: now + 60 };
const encode = (value: string | Uint8Array) => Buffer.from(value).toString('base64url');
async function signedToken(overrides = {}, algorithm = 'RS256') {
  const header = encode(JSON.stringify({ alg: algorithm, kid: 'test-key' }));
  const payload = encode(JSON.stringify({ ...claims, ...overrides }));
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey,
    new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${encode(new Uint8Array(signature))}`;
}
const fetchKeys = vi.fn(async () => Response.json({ keys: [{ ...publicKey, kid: 'test-key' }] }));

beforeAll(async () => {
  pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey);
});

describe('Access subject-token broker', () => {
  it('accepts only the signed staging service identity and retrieves keys from the configured issuer', async () => {
    await expect(verifyAccessToken(await signedToken(), config, fetchKeys, now)).resolves.toBeUndefined();
    expect(fetchKeys).toHaveBeenCalledWith(`${config.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`,
      expect.objectContaining({ redirect: 'error' }));
  });

  it.each([
    ['issuer', { iss: 'https://other-team.cloudflareaccess.com' }],
    ['audience', { aud: ['other-app'] }],
    ['service identity', { common_name: 'other-service.access' }],
    ['human token', { sub: 'user-uuid' }],
    ['expiry', { exp: now }],
    ['future token', { nbf: now + 60 }],
  ])('rejects incorrect %s even with a valid signature', async (_, override) => {
    await expect(verifyAccessToken(await signedToken(override), config, fetchKeys, now)).rejects.toThrow();
  });

  it('rejects a spoofed assertion with tampered claims', async () => {
    const token = await signedToken();
    const parts = token.split('.');
    parts[1] = encode(JSON.stringify({ ...claims, exp: now + 120 }));
    await expect(verifyAccessToken(parts.join('.'), config, fetchKeys, now)).rejects.toThrow('Invalid signature');
  });

  it('rejects unsigned and malformed JWTs', async () => {
    await expect(verifyAccessToken(await signedToken({}, 'none'), config, fetchKeys, now)).rejects.toThrow();
    await expect(verifyAccessToken('not-a-token', config, fetchKeys, now)).rejects.toThrow();
  });

  it('fails closed for missing header or configuration and never echoes a rejected assertion', async () => {
    const request = new Request('https://broker.workers.dev/token');
    const missing = await broker.fetch(request, config);
    expect(missing.status).toBe(401);
    const bad = await broker.fetch(new Request(request, {
      headers: { 'Cf-Access-Jwt-Assertion': 'spoofed' },
    }), { ...config, ACCESS_TEAM_DOMAIN: '' });
    expect(bad.status).toBe(401);
    expect(await bad.text()).toBe('Unauthorized');
    expect(bad.headers.get('Cache-Control')).toBe('no-store');
  });

  it('exposes only GET /token', async () => {
    expect((await broker.fetch(new Request('https://broker.workers.dev/'), config)).status).toBe(404);
    expect((await broker.fetch(new Request('https://broker.workers.dev/token', { method: 'POST' }), config)).status).toBe(405);
  });
});
