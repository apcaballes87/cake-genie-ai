import type { BlogPost } from '@/services/supabaseService';

export interface BlogDesignShowcaseConfig {
  id: string;
  keyword: string;
  title: string;
  intro?: string;
}

export interface BlogContentSegment {
  type: 'content' | 'showcase';
  content?: string;
  showcaseId?: string;
}

interface RawBlogDesignShowcaseConfig {
  id?: string;
  keyword?: string;
  keywords?: string;
  title?: string;
  intro?: string;
}

const DEFAULT_SHOWCASE_ID = 'default';
const SHOWCASE_PLACEHOLDER_REGEX = /\[\[\s*design_showcase:([a-z0-9_-]+)\s*\]\]/gi;

const toTitleCase = (value: string) =>
  value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const toShowcaseId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function buildShowcaseConfig(
  raw: RawBlogDesignShowcaseConfig,
  fallbackId: string,
): BlogDesignShowcaseConfig | null {
  const keyword = (raw.keyword || raw.keywords || '').trim();

  if (!keyword) {
    return null;
  }

  const title = raw.title?.trim() || `${toTitleCase(keyword.split(',')[0])} Designs`;
  const intro = raw.intro?.trim() || undefined;
  const id = toShowcaseId(raw.id || fallbackId) || fallbackId;

  return {
    id,
    keyword,
    title,
    intro,
  };
}

function parseRawShowcaseEntries(value: BlogPost['design_showcases']): RawBlogDesignShowcaseConfig[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

export function getBlogDesignShowcaseConfigs(
  post: Pick<
    BlogPost,
    'design_showcases' | 'design_showcase_keywords' | 'design_showcase_title' | 'design_showcase_intro'
  >,
): BlogDesignShowcaseConfig[] {
  const usedIds = new Set<string>();
  const configs: BlogDesignShowcaseConfig[] = [];

  const rawEntries = parseRawShowcaseEntries(post.design_showcases);

  rawEntries.forEach((entry, index) => {
    const baseId = toShowcaseId(entry.id || entry.keyword || entry.keywords || '') || `showcase-${index + 1}`;
    const config = buildShowcaseConfig(entry, baseId);

    if (!config) {
      return;
    }

    let uniqueId = config.id;
    let suffix = 2;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${config.id}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(uniqueId);
    configs.push({ ...config, id: uniqueId });
  });

  if (configs.length > 0) {
    return configs;
  }

  const legacyConfig = buildShowcaseConfig(
    {
      id: DEFAULT_SHOWCASE_ID,
      keyword: post.design_showcase_keywords,
      title: post.design_showcase_title,
      intro: post.design_showcase_intro,
    },
    DEFAULT_SHOWCASE_ID,
  );

  return legacyConfig ? [legacyConfig] : [];
}

export function splitBlogContentByShowcasePlaceholders(content: string): BlogContentSegment[] {
  const segments: BlogContentSegment[] = [];
  let lastIndex = 0;

  SHOWCASE_PLACEHOLDER_REGEX.lastIndex = 0;

  for (const match of content.matchAll(SHOWCASE_PLACEHOLDER_REGEX)) {
    const [fullMatch, showcaseId] = match;
    const matchIndex = match.index ?? 0;
    const textBefore = content.slice(lastIndex, matchIndex);

    if (textBefore.trim()) {
      segments.push({ type: 'content', content: textBefore });
    }

    segments.push({ type: 'showcase', showcaseId: showcaseId.toLowerCase() });
    lastIndex = matchIndex + fullMatch.length;
  }

  const remainingContent = content.slice(lastIndex);
  if (remainingContent.trim()) {
    segments.push({ type: 'content', content: remainingContent });
  }

  return segments.length > 0 ? segments : [{ type: 'content', content }];
}