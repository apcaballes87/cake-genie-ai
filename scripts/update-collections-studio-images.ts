import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import {
  canPublishCollection,
  resolveCollectionPublicationStatus,
} from '../src/lib/collections/quality';
import { getCollectionSearchMetadata } from '../src/lib/collections/searchMetadata';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function refreshCollections(isDryRun: boolean, targetSlugs?: string[]) {
  let query = supabase
    .from('cakegenie_collections')
    .select('id,name,slug,item_count,matched_design_count,studio_image_count,sample_image,publication_status')
    .order('slug', { ascending: true });

  if (targetSlugs && targetSlugs.length > 0) {
    query = query.in('slug', targetSlugs);
  }

  const { data: collections, error } = await query;
  if (error) throw error;

  let changed = 0;
  let failed = 0;

  for (const collection of collections || []) {
    try {
      const metadata = await getCollectionSearchMetadata(supabase, collection.name);
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
      const didChange = collection.item_count !== metadata.matchedDesignCount
        || collection.matched_design_count !== metadata.matchedDesignCount
        || collection.studio_image_count !== metadata.studioImageCount
        || collection.sample_image !== metadata.sampleImage
        || collection.publication_status !== nextStatus;

      console.log(JSON.stringify({
        slug: collection.slug,
        searchQuery: metadata.searchQuery,
        matchKind: metadata.matchKind,
        previousCount: collection.item_count || 0,
        matchedDesignCount: metadata.matchedDesignCount,
        sampleSlug: metadata.sampleSlug,
        changed: didChange,
        dryRun: isDryRun,
      }));

      if (didChange) changed += 1;
      if (!isDryRun && didChange) {
        const { error: updateError } = await supabase
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
    } catch (collectionError) {
      failed += 1;
      console.error(JSON.stringify({
        slug: collection.slug,
        error: collectionError instanceof Error
          ? collectionError.message
          : 'collection-refresh-failed',
      }));
    }
  }

  return { processed: collections?.length || 0, changed, failed, dryRun: isDryRun };
}

async function main() {
  const summary = await refreshCollections(process.argv.includes('--dry-run'));
  console.log(JSON.stringify({ summary }));
  if (summary.failed > 0) process.exitCode = 1;
}

if (process.argv[1]?.includes('update-collections-studio-images')) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
