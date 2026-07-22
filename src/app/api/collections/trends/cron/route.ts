import { NextResponse } from 'next/server';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';
import {
  canPublishCollection,
  normalizeTrendCollectionSlug,
  resolveCollectionPublicationStatus,
} from '@/lib/collections/quality';
import { getCollectionSearchMetadata } from '@/lib/collections/searchMetadata';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DATAFORSEO_URL = 'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live';
const TREND_SEEDS = [
  'trending cake theme',
  'kids show cake',
  'game cake',
  'movie cake',
  'anime cake',
  'kpop cake',
  'pop star cake',
  'collectible toy cake',
  'viral character cake',
];
const MAX_CANDIDATES = 40;
const GENERIC_SLUGS = new Set([
  'cake',
  'birthday-cake',
  'custom-cake',
  'trending-cake',
  'kids-cake',
  'movie-cake',
  'game-cake',
  'anime-cake',
  'kpop-cake',
  'toy-cake',
  'character-cake',
]);

type DataForSeoIdea = {
  keyword?: string;
  keyword_info?: {
    search_volume?: number;
    search_volume_trend?: {
      monthly?: number;
      quarterly?: number;
      yearly?: number;
    };
  };
};

type DataForSeoResponse = {
  tasks?: Array<{
    result?: Array<{
      items?: DataForSeoIdea[];
    }>;
  }>;
};

function getTrendScore(idea: DataForSeoIdea): number {
  const volume = idea.keyword_info?.search_volume || 0;
  const trend = idea.keyword_info?.search_volume_trend;
  const strongestTrend = Math.max(trend?.monthly || 0, trend?.quarterly || 0, trend?.yearly || 0);
  return volume + Math.max(0, strongestTrend) * 10;
}

function hasTrendEvidence(idea: DataForSeoIdea): boolean {
  const volume = idea.keyword_info?.search_volume || 0;
  const trend = idea.keyword_info?.search_volume_trend;
  return volume > 0 || Math.max(trend?.monthly || 0, trend?.quarterly || 0, trend?.yearly || 0) > 0;
}

function buildDescription(name: string): string {
  return `Browse ${name.toLowerCase()} designs for personalized celebrations in Cebu. Choose a real cake design, customize the size, message, and details, then check instant pricing and available Metro Cebu delivery or pickup options.`;
}

function buildTags(keyword: string): string[] {
  const clean = keyword.trim().toLowerCase();
  const withoutCake = clean.replace(/\s+cakes?$/i, '').trim();
  return Array.from(new Set([withoutCake, clean, `${withoutCake} cake`, `${withoutCake} cakes`].filter(Boolean)));
}

async function fetchTrendIdeas(): Promise<DataForSeoIdea[]> {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();

  if (!login || !password) {
    throw new Error('Missing DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD.');
  }

  const response = await fetch(DATAFORSEO_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{
      keywords: TREND_SEEDS,
      location_name: 'Philippines',
      language_code: 'en',
      limit: 100,
      order_by: ['keyword_info.search_volume,desc'],
    }]),
  });

  if (!response.ok) {
    throw new Error(`DataForSEO request failed with ${response.status}.`);
  }

  const payload = await response.json() as DataForSeoResponse;
  return payload.tasks?.flatMap((task) => task.result?.flatMap((result) => result.items || []) || []) || [];
}

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const admin = createAdminServerSupabaseClient();
    const ideas = (await fetchTrendIdeas())
      .filter((idea) => idea.keyword && hasTrendEvidence(idea))
      .sort((a, b) => getTrendScore(b) - getTrendScore(a))
      .slice(0, MAX_CANDIDATES);

    const { data: existingRows, error: existingError } = await admin
      .from('cakegenie_collections')
      .select('slug,publication_status,trend_source');

    if (existingError) throw existingError;

    const existingBySlug = new Map((existingRows || []).map((row) => [row.slug, row]));
    const results: Array<Record<string, unknown>> = [];

    for (const idea of ideas) {
      const keyword = idea.keyword!.trim();
      const slug = normalizeTrendCollectionSlug(keyword);
      const existing = existingBySlug.get(slug);
      if (!slug || GENERIC_SLUGS.has(slug) || (existing && existing.publication_status !== 'stocking')) {
        results.push({ keyword, slug, status: 'rejected', reason: 'existing-generic-or-invalid-slug' });
        continue;
      }

      let metadata;
      try {
        metadata = await getCollectionSearchMetadata(admin, keyword);
      } catch (error) {
        results.push({
          keyword,
          slug,
          status: 'rejected',
          reason: error instanceof Error ? error.message : 'collection-search-failed',
        });
        continue;
      }

      const {
        matchedDesignCount,
        studioImageCount,
        sampleImage,
        sampleSlug,
        searchQuery,
      } = metadata;
      const qualityInput = {
        matchedDesignCount,
        sampleImage,
        hasDistinctIntent: true,
        hasTrendEvidence: true,
      };
      const publicationStatus = resolveCollectionPublicationStatus(qualityInput);
      const isPublished = canPublishCollection(qualityInput);
      const name = slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

      const { error: upsertError } = await admin
        .from('cakegenie_collections')
        .upsert({
          name,
          slug,
          tags: buildTags(keyword),
          description: buildDescription(name),
          sample_image: sampleImage,
          item_count: matchedDesignCount,
          matched_design_count: matchedDesignCount,
          studio_image_count: studioImageCount,
          collection_type: 'entertainment',
          trend_source: 'dataforseo',
          trend_score: getTrendScore(idea),
          trend_checked_at: new Date().toISOString(),
          published_at: isPublished ? new Date().toISOString() : null,
          publication_status: publicationStatus,
          is_indexable: isPublished,
        }, { onConflict: 'slug' });

      if (upsertError) throw upsertError;

      results.push({
        keyword,
        slug,
        status: publicationStatus,
        matchedDesignCount,
        studioImageCount,
        searchQuery,
        sampleSlug,
      });
      existingBySlug.set(slug, { slug, publication_status: publicationStatus, trend_source: 'dataforseo' });
    }

    return NextResponse.json({
      processed: results.length,
      published: results.filter((result) => result.status === 'published').length,
      stocking: results.filter((result) => result.status === 'stocking').length,
      rejected: results.filter((result) => result.status === 'rejected').length,
      results,
    });
  } catch (error) {
    console.error('Collection trend cron failed:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Collection trend cron failed.',
    }, { status: 500 });
  }
}
