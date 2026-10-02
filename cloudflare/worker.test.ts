import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { CRON_ROUTES, cronLockKey, cronRoute } from './cron';
import { appEnvironment, requiredBinding } from './runtime-config';

describe('Cloudflare container configuration', () => {
  it('does not activate production traffic or cron triggers before cutover', () => {
    const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
    expect(config.triggers.crons).toEqual([]);
    expect(config.env.production.triggers.crons).toEqual([]);
    expect(config.routes).toBeUndefined();
    expect(config.env.production.routes).toBeUndefined();
    expect(config.containers[0].max_instances).toBe(1);
    expect(config.env.production.containers[0].max_instances).toBe(1);
  });

  it('maps exactly the five deployed Vercel schedules, with Monday spelled out', () => {
    expect(CRON_ROUTES).toEqual({
      '0 1 * * *': '/api/pinterest/cron',
      '0 2 * * MON': '/api/collections/trends/cron',
      '0 3 * * MON': '/api/collections/refresh/cron',
      '0 * * * *': '/api/seo/cron',
      '15 * * * *': '/api/studio/cron',
    });
    expect(cronRoute('0 2 * * MON')).toBe('/api/collections/trends/cron');
    expect(() => cronRoute('0 2 * * 1')).toThrow('Unrecognized Cloudflare cron');
  });

  it('keys duplicate prevention to the expression and scheduled instant', () => {
    expect(cronLockKey('0 * * * *', 1)).toBe(cronLockKey('0 * * * *', 1));
    expect(cronLockKey('0 * * * *', 1)).not.toBe(cronLockKey('0 * * * *', 2));
  });

  it('passes only allowlisted string values to the Node container', () => {
    expect(appEnvironment({
      CRON_SECRET: 'secret',
      NEXT_PUBLIC_SITE_URL: 'https://genie.ph',
      UNRELATED_SECRET: 'no',
      GENIE_APP: {},
    })).toEqual({ CRON_SECRET: 'secret', NEXT_PUBLIC_SITE_URL: 'https://genie.ph' });
    expect(requiredBinding({ CRON_SECRET: 'secret' }, 'CRON_SECRET')).toBe('secret');
    expect(() => requiredBinding({}, 'CRON_SECRET')).toThrow('Missing Cloudflare binding');
  });
});
