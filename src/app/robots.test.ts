import { describe, expect, it } from 'vitest';

import robots from './robots';

function rules() {
  const value = robots().rules;
  if (!Array.isArray(value)) throw new Error('Expected ordered robots rules');
  return value;
}

describe('robots metadata route', () => {
  it('explicitly allows Meta sharing crawlers while keeping private paths blocked', () => {
    const metaRule = rules().find((rule) => {
      const agents = Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent];
      return agents.includes('facebookexternalhit');
    });

    expect(metaRule).toBeDefined();
    expect(metaRule?.allow).toBe('/');
    expect(metaRule?.disallow).toEqual(
      expect.arrayContaining(['/admin/', '/api/', '/account/']),
    );
    expect(metaRule?.disallow).not.toContain('/_next/');
    expect(metaRule?.disallow).not.toContain('/customizing?*');
    expect(metaRule?.disallow).not.toContain('/customizing/*?*');
  });

  it('lets crawlers read noindex on cake option share URLs', () => {
    const generalRule = rules().find((rule) => rule.userAgent === '*');
    const aiRule = rules().find((rule) => Array.isArray(rule.userAgent) && rule.userAgent.includes('GPTBot'));

    expect(generalRule?.allow).toEqual(expect.arrayContaining(['/customizing/*?caketype=*']));
    expect(aiRule?.allow).toEqual(expect.arrayContaining(['/customizing/*?caketype=*']));
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

  it('allows rendering resources for general and AI crawlers', () => {
    for (const rule of rules()) {
      expect(rule.disallow).not.toContain('/_next/');
    }
  });

  it('lets crawlers read noindex on private completion and recovery pages', () => {
    const generalRule = rules().find((rule) => rule.userAgent === '*');
    expect(generalRule?.disallow).not.toContain('/order-confirmation/');
    expect(generalRule?.disallow).not.toContain('/forgot-password/');
    expect(generalRule?.disallow).not.toContain('/auth/');
  });
});
