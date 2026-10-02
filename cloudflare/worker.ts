import { Container, getContainer } from '@cloudflare/containers';
import { Redis } from '@upstash/redis';
import { env as workerEnv } from 'cloudflare:workers';

import { cronLockKey, cronRoute } from './cron';
import { appEnvironment, requiredBinding } from './runtime-config';

const CONTAINER_NAME = 'genieph-app';
const CRON_LOCK_SECONDS = 24 * 60 * 60;

export class GenieContainer extends Container {
  defaultPort = 8080;
  sleepAfter = '2h';
  envVars = appEnvironment(workerEnv);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === 'www.genie.ph') {
      url.hostname = 'genie.ph';
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 308);
    }

    // Do not trust client-supplied proxy headers. The body remains a stream.
    const headers = new Headers(request.headers);
    for (const name of [
      'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip',
      'x-vercel-forwarded-for', 'x-vercel-ip-country', 'x-vercel-oidc-token', 'cf-ipcountry',
    ]) headers.delete(name);
    const clientIp = request.headers.get('cf-connecting-ip');
    if (clientIp) {
      headers.set('x-forwarded-for', clientIp);
      headers.set('x-real-ip', clientIp);
    }
    headers.set('x-forwarded-host', url.host);
    headers.set('x-forwarded-proto', url.protocol.slice(0, -1));
    if (request.cf?.country) headers.set('cf-ipcountry', request.cf.country);

    return getContainer(env.GENIE_APP, CONTAINER_NAME).fetch(new Request(request, { headers }));
  },

  async scheduled(controller, env): Promise<void> {
    const path = cronRoute(controller.cron);
    const secret = requiredBinding(env, 'CRON_SECRET');
    const redis = new Redis({
      url: requiredBinding(env, 'KV_REST_API_URL'),
      token: requiredBinding(env, 'KV_REST_API_TOKEN'),
    });
    const lockKey = cronLockKey(controller.cron, controller.scheduledTime);
    const acquired = await redis.set(lockKey, 'running', { nx: true, ex: CRON_LOCK_SECONDS });
    if (!acquired) {
      console.log(JSON.stringify({ event: 'cron_duplicate_skipped', cron: controller.cron }));
      return;
    }

    // Keep the lock even on failure: the route may already have performed a
    // partial external write. Investigate before manually retrying that slot.
    const response = await getContainer(env.GENIE_APP, CONTAINER_NAME).fetch(
      new Request(`https://genie.ph${path}`, {
        headers: { authorization: `Bearer ${secret}` },
      }),
    );
    if (!response.ok) throw new Error(`Cron ${path} failed with HTTP ${response.status}`);
    console.log(JSON.stringify({ event: 'cron_completed', cron: controller.cron, status: response.status }));
  },
} satisfies ExportedHandler<Env>;
