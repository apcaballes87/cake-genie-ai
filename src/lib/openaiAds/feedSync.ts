import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import SftpClient from 'ssh2-sftp-client';
import { CANONICAL_CAKE_TYPES } from '@/lib/utils/cakeType';
import { getCommercePolicyUrls } from '@/lib/commerce/machineReadable';
import {
  buildLowestPriceOptionsByCakeType,
  buildOpenAIAdsCatalogCsv,
  buildOpenAIAdsCatalogProducts,
  type OpenAIAdsCatalogDesign,
} from '@/lib/openaiAds/catalog';

const OPENAI_ADS_UPLOADS_URL = 'https://api.ads.openai.com/v1/feeds/uploads';
const CATALOG_FILE_NAME = 'catalog.csv';
const CATALOG_PAGE_SIZE = 1000;

interface OpenAIAdsFeedUpload {
  feed_id?: string;
  upload_id?: string;
  created_at?: string;
  status?: string;
  rows_accepted?: number;
  rows_rejected?: number;
  rows_ads_eligible?: number;
  diagnostics?: Array<{
    code?: string;
    severity?: string;
    field?: string;
    rows_affected?: number;
  }>;
}

export interface OpenAIAdsCatalogSyncResult {
  status: 'disabled' | 'uploaded' | 'empty_catalog';
  eligibleProducts?: number;
  latestIngestion?: {
    status: string | null;
    rowsAccepted: number | null;
    rowsRejected: number | null;
    rowsAdsEligible: number | null;
    diagnostics: Array<{
      code: string | null;
      severity: string | null;
      field: string | null;
      rowsAffected: number | null;
    }>;
  } | null;
  ingestionCheck?: 'available' | 'pending' | 'unavailable';
}

const UPLOAD_STATUS_POLL_ATTEMPTS = 4;
const UPLOAD_STATUS_POLL_INTERVAL_MS = 2_000;
const UPLOAD_STATUS_REQUEST_TIMEOUT_MS = 4_000;

export function isTerminalOpenAIAdsUploadStatus(status: string | null | undefined): boolean {
  return ['completed', 'completed_with_errors', 'skipped', 'failed']
    .includes(status?.trim().toLowerCase() || '');
}

function parseSftpConnection(uriValue: string): {
  host: string;
  port: number;
  username: string;
} {
  let uri: URL;
  try {
    uri = new URL(uriValue);
  } catch {
    throw new Error('OpenAI Ads SFTP URI is invalid.');
  }

  if (uri.protocol !== 'sftp:' || !uri.hostname) {
    throw new Error('OpenAI Ads SFTP URI must use the sftp scheme and include a host.');
  }

  const username = process.env.OPENAI_ADS_SFTP_USERNAME?.trim()
    || decodeURIComponent(uri.username);
  if (!username) throw new Error('OpenAI Ads SFTP username is required.');

  return {
    host: uri.hostname,
    port: uri.port ? Number(uri.port) : 22,
    username,
  };
}

async function uploadCatalog(csv: string, uri: string): Promise<void> {
  const connection = parseSftpConnection(uri);
  const password = process.env.OPENAI_ADS_SFTP_PASSWORD;
  const privateKeyValue = process.env.OPENAI_ADS_SFTP_PRIVATE_KEY;
  if (!password && !privateKeyValue) {
    throw new Error('OpenAI Ads SFTP password or private key is required.');
  }

  const privateKey = privateKeyValue?.replace(/\\n/g, '\n');
  const client = new SftpClient('openai-ads-catalog');
  try {
    await client.connect({
      ...connection,
      ...(password ? { password } : {}),
      ...(privateKey ? { privateKey } : {}),
      ...(process.env.OPENAI_ADS_SFTP_PRIVATE_KEY_PASSPHRASE
        ? { passphrase: process.env.OPENAI_ADS_SFTP_PRIVATE_KEY_PASSPHRASE }
        : {}),
      readyTimeout: 15_000,
    });
    await client.put(Buffer.from(csv, 'utf8'), CATALOG_FILE_NAME);
  } finally {
    await client.end().catch(() => undefined);
  }
}

function toCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function summarizeUpload(upload: OpenAIAdsFeedUpload | undefined): OpenAIAdsCatalogSyncResult['latestIngestion'] {
  if (!upload) return null;
  return {
    status: typeof upload.status === 'string' ? upload.status : null,
    rowsAccepted: toCount(upload.rows_accepted),
    rowsRejected: toCount(upload.rows_rejected),
    rowsAdsEligible: toCount(upload.rows_ads_eligible),
    diagnostics: (Array.isArray(upload.diagnostics) ? upload.diagnostics : [])
      .slice(0, 10)
      .map((diagnostic) => ({
        code: typeof diagnostic.code === 'string' ? diagnostic.code : null,
        severity: typeof diagnostic.severity === 'string' ? diagnostic.severity : null,
        field: typeof diagnostic.field === 'string' ? diagnostic.field : null,
        rowsAffected: toCount(diagnostic.rows_affected),
      })),
  };
}

async function fetchLatestFeedUpload(
  apiKey: string,
  feedId: string,
): Promise<{ upload: OpenAIAdsFeedUpload | null; available: boolean }> {
  try {
    const response = await fetch(OPENAI_ADS_UPLOADS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(UPLOAD_STATUS_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return { upload: null, available: false };

    const body: unknown = await response.json();
    const data = body && typeof body === 'object' && 'data' in body
      ? (body as { data?: unknown }).data
      : null;
    const uploads = Array.isArray(data) ? data as OpenAIAdsFeedUpload[] : [];
    const feedUploads = uploads.filter((upload) => upload.feed_id === feedId);
    const latestFeedUpload = feedUploads.reduce<OpenAIAdsFeedUpload | null>((latest, upload) => {
      if (!latest) return upload;
      const latestTimestamp = Date.parse(latest.created_at || '');
      const uploadTimestamp = Date.parse(upload.created_at || '');
      return Number.isFinite(uploadTimestamp) && uploadTimestamp > latestTimestamp ? upload : latest;
    }, null);
    return { upload: latestFeedUpload, available: true };
  } catch {
    return { upload: null, available: false };
  }
}

async function waitForLatestIngestion(
  apiKey: string,
  feedId: string,
  previousUploadId: string | null,
): Promise<{
  ingestion: OpenAIAdsCatalogSyncResult['latestIngestion'];
  check: 'available' | 'pending' | 'unavailable';
}> {
  let latestNewUpload: OpenAIAdsFeedUpload | null = null;

  for (let attempt = 0; attempt < UPLOAD_STATUS_POLL_ATTEMPTS; attempt += 1) {
    const result = await fetchLatestFeedUpload(apiKey, feedId);
    if (!result.available) return { ingestion: null, check: 'unavailable' };

    const upload = result.upload;
    if (upload && (!previousUploadId || upload.upload_id !== previousUploadId)) {
      latestNewUpload = upload;
      if (isTerminalOpenAIAdsUploadStatus(upload.status)) {
        return { ingestion: summarizeUpload(upload), check: 'available' };
      }
    }

    if (attempt < UPLOAD_STATUS_POLL_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, UPLOAD_STATUS_POLL_INTERVAL_MS));
    }
  }

  return latestNewUpload
    ? { ingestion: summarizeUpload(latestNewUpload), check: 'pending' }
    : { ingestion: null, check: 'pending' };
}

async function fetchPublishedDesigns(supabase: SupabaseClient): Promise<OpenAIAdsCatalogDesign[]> {
  const designs: OpenAIAdsCatalogDesign[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('slug,seo_title,seo_description,alt_text,keywords,tags,price,availability,studio_edited_image_url,analysis_json')
      .eq('seo_status', 'published')
      .not('slug', 'is', null)
      .not('studio_edited_image_url', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + CATALOG_PAGE_SIZE - 1);

    if (error) throw new Error('Could not read the published Genie.ph design catalog.');
    if (!data?.length) break;

    designs.push(...data as OpenAIAdsCatalogDesign[]);
    if (data.length < CATALOG_PAGE_SIZE) break;
    offset += CATALOG_PAGE_SIZE;
  }

  return designs;
}

export async function syncOpenAIAdsCatalog(): Promise<OpenAIAdsCatalogSyncResult> {
  if (process.env.OPENAI_ADS_CATALOG_SYNC_ENABLED?.trim().toLowerCase() !== 'true') {
    return { status: 'disabled' };
  }

  const apiKey = process.env.OPENAI_ADS_API_KEY?.trim();
  const feedId = process.env.OPENAI_ADS_FEED_ID?.trim();
  const sftpUri = process.env.OPENAI_ADS_SFTP_URI?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!apiKey || !feedId || !sftpUri || !supabaseUrl || !supabaseAnonKey) {
    throw new Error('OpenAI Ads catalog sync is enabled but required configuration is missing.');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [designsResult, pricesResult] = await Promise.all([
    fetchPublishedDesigns(supabase),
    supabase
      .from('productsizes_cakegenie')
      .select('type,cakesize,price,display_order')
      .in('type', [...CANONICAL_CAKE_TYPES]),
  ]);

  if (pricesResult.error) throw new Error('Could not read Genie.ph cake pricing options.');

  const products = buildOpenAIAdsCatalogProducts(designsResult, {
    pricesByCakeType: buildLowestPriceOptionsByCakeType(pricesResult.data || []),
    returnPolicyUrl: getCommercePolicyUrls().returnPolicy,
  });
  if (products.length === 0) return { status: 'empty_catalog', eligibleProducts: 0 };

  const previousUpload = await fetchLatestFeedUpload(apiKey, feedId);
  await uploadCatalog(buildOpenAIAdsCatalogCsv(products), sftpUri);
  const ingestion = await waitForLatestIngestion(
    apiKey,
    feedId,
    previousUpload.upload?.upload_id || null,
  );

  return {
    status: 'uploaded',
    eligibleProducts: products.length,
    latestIngestion: ingestion.ingestion,
    ingestionCheck: ingestion.check,
  };
}
