import { describe, expect, it } from 'vitest'

import {
  FEATURED_COLLECTION_LINKS,
  PRIORITY_COLLECTION_SEO,
} from './priorityCollections'

describe('priority collection SEO', () => {
  it('promotes minimalist cake as the ninth featured collection', () => {
    expect(FEATURED_COLLECTION_LINKS).toHaveLength(9)
    expect(FEATURED_COLLECTION_LINKS.map(({ slug }) => slug)).toEqual([
      'bento-cake',
      'minimalist-cake',
      'katseye-cake',
      'kuromi-cake',
      'minecraft-cake',
      'graduation-cake',
      'debut-cake',
      '30th-birthday-cake',
      'senior-cake',
    ])
  })

  it('uses the approved Cebu buyer description and metadata keywords', () => {
    expect(PRIORITY_COLLECTION_SEO['minimalist-cake']).toEqual({
      description: 'Compare Korean-style, pastel, vintage-piped, and simple birthday cakes in Cebu. Open a design to customize its message, colors, and size and see starting prices.',
      keywords: [
        'minimalist cake design',
        'minimalist cake cebu',
        'korean minimalist cake',
        'simple birthday cake cebu',
      ],
    })
  })
})
