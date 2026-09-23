import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { SYSTEM_INSTRUCTION } from '@/lib/ai/prompts';
import { FALLBACK_ANALYSIS_PROMPT_VERSION } from './promptLoader';

const rootDir = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(rootDir, path), 'utf8');
}

describe('v3.96 side-positioned edible character figures', () => {
  it('keeps detailed handmade edible characters in main_toppers regardless of tier placement', () => {
    const prompt = readProjectFile('src/services/prompts/fallback-prompt.txt');
    const fixture = JSON.parse(readProjectFile(
      'src/services/prompts/fixtures/spider-man-side-character-main-topper.json',
    )) as {
      case_slug: string;
      visual_observation: string;
      expected_main_toppers: Array<Record<string, unknown>>;
      forbidden_support_group_ids: string[];
      nearest_non_qualifying_constructions: Array<{ construction: string; type: string }>;
    };

    expect(prompt).toContain('**v3.96 Version - Side-Positioned Edible Character Figures**');
    expect(prompt).toContain('#### HANDMADE EDIBLE CHARACTER FIGURE OVERRIDE (BINDING)');
    expect(prompt).toContain('Position never changes this classification.');
    expect(prompt).toContain('Spider-Man figures crawling on or sitting against a tier');
    expect(prompt).toContain('flat-backed illustration, or shallow-relief character image');
    expect(prompt).toContain('rigid manufactured characters remain');
    expect(prompt).toContain('glazed ceramic-look breakable figures remain');
    expect(SYSTEM_INSTRUCTION).toContain('regardless of position or attachment to the cake');
    expect(SYSTEM_INSTRUCTION).toContain('Never put a qualifying figure in "support_elements" because of position.');
    expect(fixture.case_slug).toBe('spider-man-cake-blue-2-tier-fondant-cake-0f4d');
    expect(fixture.visual_observation).toContain('crawling on the blue tier side');
    expect(fixture.expected_main_toppers).toHaveLength(3);
    expect(fixture.expected_main_toppers.filter((row) => row.position === 'tier_side')).toEqual([
      {
        group_id: 'spider_man_crawling',
        collection: 'main_toppers',
        type: 'edible_3d_complex',
        material: 'edible_fondant',
        classification: 'hero',
        quantity: 1,
        position: 'tier_side',
      },
      {
        group_id: 'black_suit_spider_man',
        collection: 'main_toppers',
        type: 'edible_3d_complex',
        material: 'edible_fondant',
        classification: 'hero',
        quantity: 1,
        position: 'tier_side',
      },
    ]);
    expect(fixture.forbidden_support_group_ids).toEqual([
      'spider_man_crawling',
      'black_suit_spider_man',
    ]);
    expect(fixture.nearest_non_qualifying_constructions.map(({ type }) => type)).toEqual([
      'edible_2d_complex',
      'toy',
      'figurine',
      'edible_3d_ordinary',
    ]);
    expect(prompt).toContain('follows the binding character-figure override below;');
    expect(createHash('md5').update(prompt).digest('hex')).toBe('afc7a90e525fcc74fa7c018f6d47d1ea');
  });

  it('keeps the fallback byte-identical to the activated v3.96 prompt', () => {
    const fallback = readProjectFile('src/services/prompts/fallback-prompt.txt');
    expect(FALLBACK_ANALYSIS_PROMPT_VERSION).toBe('3.96');
    expect(createHash('md5').update(fallback).digest('hex')).toBe('afc7a90e525fcc74fa7c018f6d47d1ea');
    expect(fallback).toContain('**v3.96 Version - Side-Positioned Edible Character Figures**');
    expect(fallback).toContain('HANDMADE EDIBLE CHARACTER FIGURE OVERRIDE (BINDING)');
  });
});
