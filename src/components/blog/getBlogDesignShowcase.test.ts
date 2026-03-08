import { describe, expect, it } from 'vitest';
import {
  getBlogDesignShowcaseConfigs,
  splitBlogContentByShowcasePlaceholders,
} from './getBlogDesignShowcase';

describe('getBlogDesignShowcaseConfigs', () => {
  it('returns an empty array when no showcase config exists', () => {
    expect(
      getBlogDesignShowcaseConfigs({
        design_showcase_keywords: '   ',
      }),
    ).toEqual([]);
  });

  it('builds a default legacy showcase config from the keyword', () => {
    expect(
      getBlogDesignShowcaseConfigs({
        design_showcase_keywords: 'cars cake',
      }),
    ).toEqual([
      {
        id: 'default',
        keyword: 'cars cake',
        title: 'Cars Cake Designs',
        intro: undefined,
      },
    ]);
  });

  it('prefers explicit title and intro when provided for the legacy fields', () => {
    expect(
      getBlogDesignShowcaseConfigs({
        design_showcase_keywords: 'cars cake',
        design_showcase_title: 'Cars Cake Ideas',
        design_showcase_intro: 'Browse real car-themed cake designs for inspiration.',
      }),
    ).toEqual([
      {
        id: 'default',
        keyword: 'cars cake',
        title: 'Cars Cake Ideas',
        intro: 'Browse real car-themed cake designs for inspiration.',
      },
    ]);
  });

  it('normalizes multiple showcase configs from the json field', () => {
    expect(
      getBlogDesignShowcaseConfigs({
        design_showcases: [
          {
            id: 'ube-minimalist',
            keywords: 'ube minimalist cakes',
            title: 'Ube Minimalist Cakes',
          },
          {
            keyword: 'korean aesthetic minimalist cakes',
            intro: 'Soft palette cake inspirations.',
          },
        ],
      }),
    ).toEqual([
      {
        id: 'ube-minimalist',
        keyword: 'ube minimalist cakes',
        title: 'Ube Minimalist Cakes',
        intro: undefined,
      },
      {
        id: 'korean-aesthetic-minimalist-cakes',
        keyword: 'korean aesthetic minimalist cakes',
        title: 'Korean Aesthetic Minimalist Cakes Designs',
        intro: 'Soft palette cake inspirations.',
      },
    ]);
  });

  it('supports array keywords and description fields from Supabase JSON rows', () => {
    expect(
      getBlogDesignShowcaseConfigs({
        design_showcases: [
          {
            title: 'Minimalist Korean-Style',
            keywords: ['minimalist', 'pastel', 'Korean style', 'elegant'],
            description: 'The classic elegant aesthetic.',
          },
        ],
      }),
    ).toEqual([
      {
        id: 'minimalist-pastel-korean-style-elegant',
        keyword: 'minimalist, pastel, Korean style, elegant',
        title: 'Minimalist Korean-Style',
        intro: 'The classic elegant aesthetic.',
      },
    ]);
  });
});

describe('splitBlogContentByShowcasePlaceholders', () => {
  it('splits blog content around showcase placeholders', () => {
    expect(
      splitBlogContentByShowcasePlaceholders(`Intro paragraph.\n\n[[design_showcase:ube-minimalist]]\n\nOutro paragraph.`),
    ).toEqual([
      { type: 'content', content: 'Intro paragraph.\n\n' },
      { type: 'showcase', showcaseId: 'ube-minimalist' },
      { type: 'content', content: '\n\nOutro paragraph.' },
    ]);
  });

  it('returns a single content segment when there are no placeholders', () => {
    expect(splitBlogContentByShowcasePlaceholders('Just regular blog content.')).toEqual([
      { type: 'content', content: 'Just regular blog content.' },
    ]);
  });
});