import { describe, expect, it } from 'vitest';

import robots from './robots';

describe('robots metadata route', () => {
  it('explicitly allows Meta sharing crawlers while keeping private paths blocked', () => {
    const config = robots();
    const metaRule = config.rules.find((rule) => {
      const agents = Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent];
      return agents.includes('facebookexternalhit');
    });

    expect(metaRule).toBeDefined();
    expect(metaRule?.allow).toBe('/');
    expect(metaRule?.disallow).toEqual(
      expect.arrayContaining(['/admin/', '/api/', '/account/', '/_next/']),
    );
  });

  it('keeps the global sitemap stable', () => {
    const config = robots();

    expect(config.sitemap).toBe('https://genie.ph/sitemap.xml');
  });
});
