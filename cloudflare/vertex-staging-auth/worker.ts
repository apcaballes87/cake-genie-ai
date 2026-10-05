// Access authenticates a dedicated staging service token before this Worker runs.
// Verify its signed identity again before returning a subject token to Google STS.
type BrokerConfig = { [K in keyof Pick<Cloudflare.Env, 'ACCESS_TEAM_DOMAIN' | 'ACCESS_AUDIENCE' | 'ACCESS_SERVICE_TOKEN_ID'>]: string };

type SigningKey = JsonWebKey & { kid?: string };

function decodePart(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Malformed JWT');
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

export async function verifyAccessToken(
  token: string,
  config: BrokerConfig,
  fetchKeys: typeof fetch = fetch,
  now = Math.floor(Date.now() / 1000),
): Promise<void> {
  const issuer = new URL(config.ACCESS_TEAM_DOMAIN);
  if (issuer.protocol !== 'https:' || !issuer.hostname.endsWith('.cloudflareaccess.com') ||
      issuer.origin !== config.ACCESS_TEAM_DOMAIN || !config.ACCESS_AUDIENCE || !config.ACCESS_SERVICE_TOKEN_ID) {
    throw new Error('Invalid broker configuration');
  }
  if (token.length > 16384) throw new Error('Token too large');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');
  const header = JSON.parse(new TextDecoder().decode(decodePart(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decodePart(parts[1])));
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.crit !== undefined) {
    throw new Error('Unsupported signing algorithm');
  }
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== config.ACCESS_TEAM_DOMAIN || !audiences.includes(config.ACCESS_AUDIENCE) ||
      claims.type !== 'app' || claims.common_name !== config.ACCESS_SERVICE_TOKEN_ID || claims.sub !== '' ||
      !Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 30 ||
      (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now + 30))) {
    throw new Error('Invalid service identity');
  }
  const response = await fetchKeys(`${issuer.origin}/cdn-cgi/access/certs`, {
    redirect: 'error', signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Signing keys unavailable');
  const jwks = await response.json() as { keys?: SigningKey[] };
  const jwk = jwks.keys?.find(key => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) throw new Error('Signing key unavailable');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodePart(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) {
    throw new Error('Invalid signature');
  }
}

export default {
  async fetch(request: Request, env: BrokerConfig): Promise<Response> {
    const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' };
    if (new URL(request.url).pathname !== '/token') return new Response('Not found', { status: 404, headers });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers });
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token) return new Response('Unauthorized', { status: 401, headers });
    try {
      await verifyAccessToken(token, env);
      return new Response(token, { headers });
    } catch {
      // Never log the assertion, client secret, or full request headers.
      return new Response('Unauthorized', { status: 401, headers });
    }
  },
};
