import { describe, expect, it } from 'vitest';
import type { HybridAnalysisResult } from '@/types';
import { buildSeoBatchInput, buildSeoPublicationMetadata } from './seoPublication';

const analysis = {
  cakeType: '1 Tier',
  cakeThickness: '4 in',
  keyword: 'unicorn birthday',
  main_toppers: [],
  support_elements: [],
  cake_messages: [{ text: 'Ari is 7', type: 'icing_script', color: '#FFFFFF', position: 'top' }],
  icing_design: {
    base: 'soft_icing', color_type: 'single', colors: { side: '#FFFFFF', top: '#FFFFFF' },
    drip: false, border_top: false, border_base: false, gumpasteBaseBoard: false,
  },
} as unknown as HybridAnalysisResult;

describe('SEO publication metadata', () => {
  it('sends structured evidence without personal message text to the batch prompt', () => {
    const input = buildSeoBatchInput(analysis);
    expect(input).toMatchObject({ has_personalized_message: true });
    expect(input).not.toHaveProperty('cake_messages');
    expect(JSON.stringify(input)).not.toContain('Ari is 7');
  });

  it('keeps titles deterministic and rejects unsupported wafer copy', () => {
    expect(() => buildSeoPublicationMetadata(analysis, {
      alt_text: 'White unicorn birthday cake with wafer paper waves and a gold horn',
      seo_description: 'A white unicorn birthday cake has smooth soft icing and a gold horn topper. The side has wafer paper waves around the cake. The design suits a unicorn birthday celebration for a child. The horn, colors, and message can be customized. The base border adds a neat finish. The cake has a playful theme.',
    }, 'normal')).toThrow(/wafer/i);

    const metadata = buildSeoPublicationMetadata(analysis, {
      alt_text: 'White unicorn birthday cake with smooth soft icing and a gold horn topper',
      seo_description: 'A white unicorn birthday cake has smooth soft icing and a gold horn topper. Small piped details add texture across the top. The design suits a unicorn birthday celebration for a child. Its color and topper choices can be customized. A neat border finishes the base. The design keeps the focus on the unicorn theme.',
    }, 'normal');
    expect(metadata.seo_title).toBeTruthy();
    expect(metadata.seo_title).not.toContain('Ari');
  });
});
