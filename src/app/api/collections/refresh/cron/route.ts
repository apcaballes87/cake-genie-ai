import { NextResponse } from 'next/server';
import { canPublishCollection, resolveCollectionPublicationStatus } from '@/lib/collections/quality';
import { getCollectionSearchMetadata } from '@/lib/collections/searchMetadata';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CONCURRENCY = 5;

type CollectionRow = {
  id: string;
  name: string;
  slug: string;
  item_count: number | null;
  matched_design_count: number | null;
  studio_image_count: number | null;
  sample_image: string | null;
  publication_status: string | null;
};

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const admin = createAdminServerSupabaseClient();
    const { data, error } = await admin
      .from('cakegenie_collections')
      .select('id,name,slug,item_count,matched_design_count,studio_image_count,sample_image,publication_status')
      .order('id', { ascending: true });

    if (error) throw error;

    const collections = (data || []) as CollectionRow[];
    const results: Array<Record<string, unknown>> = [];

    for (let index = 0; index < collections.length; index += CONCURRENCY) {
      const batch = collections.slice(index, index + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(async (collection) => {
        try {
          const metadata = await getCollectionSearchMetadata(admin, collection.name);
          const qualityInput = {
            matchedDesignCount: metadata.matchedDesignCount,
            sampleImage: metadata.sampleImage,
            hasDistinctIntent: true,
            hasTrendEvidence: true,
          };
          const promoteStocking = collection.publication_status === 'stocking'
            && canPublishCollection(qualityInput);
          const nextStatus = collection.publication_status === 'stocking'
            ? resolveCollectionPublicationStatus(qualityInput)
            : collection.publication_status;
          const changed = collection.item_count !== metadata.matchedDesignCount
            || collection.matched_design_count !== metadata.matchedDesignCount
            || collection.studio_image_count !== metadata.studioImageCount
            || collection.sample_image !== metadata.sampleImage
            || collection.publication_status !== nextStatus;

          if (changed) {
            const { error: updateError } = await admin
              .from('cakegenie_collections')
              .update({
                item_count: metadata.matchedDesignCount,
                matched_design_count: metadata.matchedDesignCount,
                studio_image_count: metadata.studioImageCount,
                sample_image: metadata.sampleImage,
                ...(collection.publication_status === 'stocking' ? {
                  publication_status: nextStatus,
                  is_indexable: promoteStocking,
                  published_at: promoteStocking ? new Date().toISOString() : null,
                } : {}),
              })
              .eq('id', collection.id);

            if (updateError) throw updateError;
          }

          return {
            slug: collection.slug,
            status: 'ok',
            changed,
            previousCount: collection.item_count || 0,
            matchedDesignCount: metadata.matchedDesignCount,
            sampleSlug: metadata.sampleSlug,
            searchQuery: metadata.searchQuery,
            matchKind: metadata.matchKind,
          };
        } catch (collectionError) {
          return {
            slug: collection.slug,
            status: 'error',
            reason: collectionError instanceof Error
              ? collectionError.message
              : 'collection-refresh-failed',
          };
        }
      }));

      results.push(...batchResults);
    }

    const failures = results.filter((result) => result.status === 'error');
    return NextResponse.json({
      processed: results.length,
      changed: results.filter((result) => result.changed === true).length,
      failed: failures.length,
      results,
    }, { status: failures.length > 0 ? 207 : 200 });
  } catch (error) {
    console.error('Collection refresh cron failed:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Collection refresh cron failed.',
    }, { status: 500 });
  }
}
