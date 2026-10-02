export const CRON_ROUTES: Readonly<Record<string, string>> = {
  '0 1 * * *': '/api/pinterest/cron',
  '0 2 * * MON': '/api/collections/trends/cron',
  '0 3 * * MON': '/api/collections/refresh/cron',
  '0 * * * *': '/api/seo/cron',
  '15 * * * *': '/api/studio/cron',
};

export function cronRoute(expression: string): string {
  const route = CRON_ROUTES[expression];
  if (!route) throw new Error(`Unrecognized Cloudflare cron: ${expression}`);
  return route;
}

export function cronLockKey(expression: string, scheduledTime: number): string {
  if (!Number.isFinite(scheduledTime)) throw new Error('Invalid cron scheduled time');
  return `genie:cloudflare-cron:${encodeURIComponent(expression)}:${scheduledTime}`;
}
