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
    expect(metaRule?.disallow).not.toContain('/customizing?*');
    expect(metaRule?.disallow).not.toContain('/customizing/*?*');
  });

  it('keeps customizer query URLs disallowed for general crawlers', () => {
    const config = robots();
    const generalRule = config.rules.find((rule) => rule.userAgent === '*');

    expect(generalRule?.disallow).toEqual(
      expect.arrayContaining(['/customizing?*', '/customizing/*?*']),
    );
    expect(generalRule?.disallow).not.toContain('/search');
  });

  it('keeps the global sitemap stable', () => {
    const config = robots();

    expect(config.sitemap).toEqual([
      'https://genie.ph/sitemap.xml',
      'https://genie.ph/sitemap-index.xml',
      'https://genie.ph/sitemap-images.xml',
    ]);
  });
});
