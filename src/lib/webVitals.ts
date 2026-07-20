export type GenieWebVitalMetric = {
  id: string
  name: string
  value: number
  delta: number
  rating: string
  navigationType?: string
}

export function getWebVitalPageType(pathname: string): string {
  if (pathname.startsWith('/blog/')) return 'blog_article'
  if (pathname === '/blog') return 'blog_index'
  if (pathname.startsWith('/collections/')) return 'collection'
  if (pathname === '/collections') return 'collection_index'
  if (pathname.startsWith('/customizing/')) return 'customizer_design'
  if (pathname === '/customizing') return 'customizer'
  if (pathname.startsWith('/shop/')) return 'shop_detail'
  if (pathname === '/shop') return 'shop_index'
  if (pathname === '/') return 'home'
  return 'other'
}

export function buildWebVitalEventParams(
  metric: GenieWebVitalMetric,
  pathname: string,
) {
  return {
    metric_name: metric.name,
    metric_value: metric.value,
    metric_delta: metric.delta,
    metric_rating: metric.rating,
    metric_id: metric.id,
    page_type: getWebVitalPageType(pathname),
    pathname,
    navigation_type: metric.navigationType || 'unknown',
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    non_interaction: true,
  }
}
