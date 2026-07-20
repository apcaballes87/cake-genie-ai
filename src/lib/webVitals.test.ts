import { describe, expect, it } from 'vitest'
import { buildWebVitalEventParams, getWebVitalPageType } from './webVitals'

describe('web vital analytics contract', () => {
  it('classifies priority SEO page types', () => {
    expect(getWebVitalPageType('/blog/bento-cake-guide-2026')).toBe('blog_article')
    expect(getWebVitalPageType('/collections/bento-cake')).toBe('collection')
    expect(getWebVitalPageType('/customizing/example-cake')).toBe('customizer_design')
  })

  it('preserves the raw metric and scales CLS for the GA4 event value', () => {
    expect(buildWebVitalEventParams({
      id: 'v1-123',
      name: 'CLS',
      value: 0.084,
      delta: 0.084,
      rating: 'good',
      navigationType: 'navigate',
    }, '/blog/bento-cake-guide-2026')).toMatchObject({
      metric_name: 'CLS',
      metric_value: 0.084,
      metric_rating: 'good',
      page_type: 'blog_article',
      pathname: '/blog/bento-cake-guide-2026',
      value: 84,
      non_interaction: true,
    })
  })
})
