/* eslint-disable @next/next/no-img-element */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  ImageIcon,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  WandSparkles,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import {
  ADMIN_IMAGE_STUDIO_PIN,
  CakeCacheImageRecord,
  IMAGE_STUDIO_PAGE_SIZE,
  IMAGE_STUDIO_SMALL_IMAGE_DIMENSION_THRESHOLD,
  ImageStudioStatus,
  isImageStudioSmallImage,
  normalizeImageStudioStatus,
} from '@/lib/admin/imageStudio';

type StatusFilter = 'all' | ImageStudioStatus;
type SizeFilter = 'all' | 'small';

type ImageListResponse = {
  items: CakeCacheImageRecord[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

const SESSION_KEY = 'genie-admin-image-studio-auth';
const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'not_started', label: 'Not started' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

function formatCurrency(value: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getStatusPillClasses(status: ImageStudioStatus) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
    case 'processing':
      return 'bg-amber-100 text-amber-700 ring-amber-200';
    case 'failed':
      return 'bg-rose-100 text-rose-700 ring-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong.';
}

export default function ImageStudioAdminClient() {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [records, setRecords] = useState<CakeCacheImageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [page, setPage] = useState(1);
  const [fetchedPage, setFetchedPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>('all');
  const [processingHash, setProcessingHash] = useState<string | null>(null);
  const [autoProcessing, setAutoProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const [isAutoContinuing, setIsAutoContinuing] = useState(false);

  const stopBatchRef = useRef(false);

  const pageSummary = useMemo(() => {
    const completed = records.filter(
      (record) => normalizeImageStudioStatus(record.studio_edit_status) === 'completed'
    ).length;
    const failed = records.filter(
      (record) => normalizeImageStudioStatus(record.studio_edit_status) === 'failed'
    ).length;

    return {
      completed,
      failed,
      ready: records.filter(
        (record) =>
          record.original_image_url &&
          normalizeImageStudioStatus(record.studio_edit_status) !== 'completed'
      ).length,
    };
  }, [records]);

  const fetchRecords = useCallback(
    async (pageToLoad: number) => {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(pageToLoad),
          pageSize: String(IMAGE_STUDIO_PAGE_SIZE),
        });

        if (searchQuery) {
          params.set('search', searchQuery);
        }

        params.set('status', statusFilter);
        params.set('size', sizeFilter);

        const response = await fetch(`/api/admin/cake-cache-images?${params.toString()}`, {
          headers: {
            'x-admin-pin': ADMIN_IMAGE_STUDIO_PIN,
          },
        });

        const payload = (await response.json()) as ImageListResponse & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load image cache rows.');
        }

        setRecords(payload.items ?? []);
        setPage(payload.page ?? pageToLoad);
        setFetchedPage(payload.page ?? pageToLoad);
        setTotalPages(payload.totalPages ?? 1);
        setTotalCount(payload.totalCount ?? 0);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error) || 'Failed to load image cache rows.');
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, sizeFilter, statusFilter]
  );

  useEffect(() => {
    const storedAuth =
      typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) === '1' : false;
    setIsAuthenticated(storedAuth);
    setIsBooting(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void fetchRecords(page);
  }, [fetchRecords, isAuthenticated, page, refreshTick]);

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (pin !== ADMIN_IMAGE_STUDIO_PIN) {
      toast.error('Invalid password');
      return;
    }

    sessionStorage.setItem(SESSION_KEY, '1');
    setIsAuthenticated(true);
    setPin('');
    toast.success('Image studio unlocked');
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setIsAuthenticated(false);
    setRecords([]);
    setAutoProcessing(false);
    setBatchProgress(null);
    stopBatchRef.current = false;
  };

  const refreshRecords = () => {
    setRefreshTick((value) => value + 1);
  };

  const applyFilters = () => {
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const updateLocalRecord = useCallback((updatedRecord: CakeCacheImageRecord) => {
    setRecords((currentRecords) =>
      currentRecords.map((record) =>
        record.p_hash === updatedRecord.p_hash
          ? {
              ...record,
              ...updatedRecord,
              studio_edit_status: normalizeImageStudioStatus(updatedRecord.studio_edit_status),
            }
          : record
      )
    );
  }, []);

  const processSingleRecord = useCallback(
    async (record: CakeCacheImageRecord, options?: { silentSuccess?: boolean }) => {
      setProcessingHash(record.p_hash);

      try {
        const response = await fetch('/api/admin/cake-cache-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-pin': ADMIN_IMAGE_STUDIO_PIN,
          },
          body: JSON.stringify({ pHash: record.p_hash }),
        });

        const payload = (await response.json()) as {
          item?: CakeCacheImageRecord;
          error?: string;
        };

        if (!response.ok || !payload.item) {
          throw new Error(payload.error || 'Image editing failed.');
        }

        updateLocalRecord(payload.item);

        if (!options?.silentSuccess) {
          toast.success(`Edited ${record.slug || record.p_hash.slice(0, 8)}`);
        }

        return true;
      } catch (error: unknown) {
        const message = getErrorMessage(error) || 'Image editing failed.';
        updateLocalRecord({
          ...record,
          studio_edit_status: 'failed',
          studio_edit_error: message,
        });
        toast.error(message);
        return false;
      } finally {
        setProcessingHash(null);
      }
    },
    [updateLocalRecord]
  );

  const handleAutoEdit = useCallback(async () => {
    const queue = records.filter(
      (record) =>
        record.original_image_url &&
        normalizeImageStudioStatus(record.studio_edit_status) !== 'completed'
    );

    if (queue.length === 0) {
      if (isAutoContinuing) {
        if (page < totalPages) {
          setBatchProgress({ current: 0, total: 0, label: 'Loading next page...' });
          setAutoProcessing(false);
          setPage((p) => p + 1);
        } else {
          setIsAutoContinuing(false);
          setAutoProcessing(false);
          setBatchProgress(null);
          toast.success('Finished auto-editing across all pages.');
        }
      } else {
        toast('Nothing on this page needs editing.');
      }
      return;
    }

    stopBatchRef.current = false;
    setAutoProcessing(true);
    setBatchProgress({ current: 0, total: queue.length, label: 'Preparing queue' });

    for (let index = 0; index < queue.length; index += 1) {
      if (stopBatchRef.current) {
        break;
      }

      const record = queue[index];
      setBatchProgress({
        current: index + 1,
        total: queue.length,
        label: record.slug || record.seo_title || record.p_hash,
      });

      await processSingleRecord(record, { silentSuccess: true });
    }

    const stopped = stopBatchRef.current;

    if (stopped) {
      setAutoProcessing(false);
      setIsAutoContinuing(false);
      setBatchProgress(null);
      stopBatchRef.current = false;
      toast('Auto-edit stopped after the active image finished.');
    } else if (page < totalPages) {
      setBatchProgress({ current: 0, total: 0, label: 'Loading next page...' });
      setAutoProcessing(false);
      setPage((p) => p + 1);
      setIsAutoContinuing(true);
    } else {
      setAutoProcessing(false);
      setIsAutoContinuing(false);
      setBatchProgress(null);
      stopBatchRef.current = false;
      toast.success('Finished auto-editing all matching images.');
    }
  }, [page, processSingleRecord, records, totalPages, isAutoContinuing]);

  useEffect(() => {
    if (isAutoContinuing && !loading && !autoProcessing && isAuthenticated && fetchedPage === page) {
      void handleAutoEdit();
    }
  }, [isAutoContinuing, loading, autoProcessing, handleAutoEdit, isAuthenticated, fetchedPage, page]);

  const handleCopyHash = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Hash copied');
    } catch {
      toast.error('Could not copy hash');
    }
  };

  if (isBooting) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center px-4">
        <div className="inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
          <LoaderCircle className="size-4 animate-spin" />
          Checking admin access…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4">
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-8 shadow-[0_24px_90px_-36px_rgba(109,40,217,0.45)] backdrop-blur">
          <div className="mb-8 inline-flex items-center gap-3 rounded-full bg-fuchsia-100 px-4 py-2 text-sm font-semibold text-fuchsia-700">
            <LockKeyhole className="size-4" />
            Admin Image Studio
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Enter password to continue
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This page lists cached cake images and can generate the pastel purple studio edit
            one image at a time or sequentially across the visible page.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleLogin}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none ring-0 transition focus:border-fuchsia-400"
                placeholder="Enter admin password"
              />
            </label>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Sparkles className="size-4" />
              Unlock image studio
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4">
      <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white/90 shadow-[0_30px_120px_-48px_rgba(168,85,247,0.45)] backdrop-blur">
        <div className="border-b border-slate-100 bg-linear-to-r from-fuchsia-600 via-violet-600 to-slate-900 px-6 py-8 text-white md:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/80">
                <WandSparkles className="size-3.5" />
                Admin image workflow
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
                Cake cache image studio
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 md:text-base">
                Review cache rows, run a consistent pastel purple cyclorama edit, and save the
                finished image back to Supabase with professional subject isolation.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={refreshRecords}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/12 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/18"
              >
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950/40 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-950/55"
              >
                <LogOut className="size-4" />
                Logout
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 md:px-8">
          <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
            <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row">
                <label className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        applyFilters();
                      }
                    }}
                    placeholder="Search by title, slug, or keywords"
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-violet-400"
                  />
                </label>

                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as StatusFilter);
                    setPage(1);
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-400"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  value={sizeFilter}
                  onChange={(event) => {
                    setSizeFilter(event.target.value as SizeFilter);
                    setPage(1);
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-400"
                >
                  <option value="all">All sizes</option>
                  <option value="small">Small images only</option>
                </select>

                <button
                  type="button"
                  onClick={applyFilters}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <Search className="size-4" />
                  Apply
                </button>
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Small images are currently anything under {IMAGE_STUDIO_SMALL_IMAGE_DIMENSION_THRESHOLD}px
                on either width or height. Auto-edit works on the currently visible page and
                skips anything already marked completed.
              </p>
            </div>

            <div className="rounded-[26px] border border-violet-100 bg-violet-50/70 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleAutoEdit}
                  disabled={autoProcessing || loading || processingHash !== null}
                  className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-violet-300"
                >
                  {autoProcessing ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <WandSparkles className="size-4" />
                  )}
                  Auto-edit visible page
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopBatchRef.current = true;
                  }}
                  disabled={!autoProcessing}
                  className="inline-flex items-center gap-2 rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  <Square className="size-4" />
                  Stop auto-edit
                </button>
              </div>

              {batchProgress ? (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-violet-800">
                    <span>
                      {batchProgress.current} / {batchProgress.total}
                    </span>
                    <span className="truncate pl-3">{batchProgress.label}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-violet-600 transition-all"
                      style={{
                        width: `${(batchProgress.current / Math.max(batchProgress.total, 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Visible
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{records.length}</p>
              <p className="mt-2 text-sm text-slate-500">
                Showing page {page} of {totalPages} across {totalCount} matching rows.
              </p>
            </div>
            <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                Completed on page
              </p>
              <p className="mt-3 text-3xl font-semibold text-emerald-900">{pageSummary.completed}</p>
              <p className="mt-2 text-sm text-emerald-700">
                Ready for reuse or download from the edited image URL.
              </p>
            </div>
            <div className="rounded-[24px] border border-amber-100 bg-amber-50/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                Remaining on page
              </p>
              <p className="mt-3 text-3xl font-semibold text-amber-900">{pageSummary.ready}</p>
              <p className="mt-2 text-sm text-amber-700">
                Includes rows that are not started yet or need a retry.
              </p>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <div className="text-sm text-slate-500">
              Each edit keeps the cake intact and swaps in the professional pastel purple cyclorama background.
            </div>
            <div className="text-sm font-medium text-slate-500">
              Failed on page: <span className="text-rose-600">{pageSummary.failed}</span>
            </div>
          </div>

          {loading ? (
            <div className="mt-8 flex min-h-[240px] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50">
              <div className="inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
                <LoaderCircle className="size-4 animate-spin" />
                Loading cached images…
              </div>
            </div>
          ) : records.length === 0 ? (
            <div className="mt-8 rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
              <ImageIcon className="mx-auto size-10 text-slate-300" />
              <h2 className="mt-4 text-xl font-semibold text-slate-900">No matching images</h2>
              <p className="mt-2 text-sm text-slate-500">
                Try another search term or switch the status filter.
              </p>
            </div>
          ) : (
            <div className="mt-8 grid gap-5 xl:grid-cols-2">
              {records.map((record) => {
                const status = normalizeImageStudioStatus(record.studio_edit_status);
                const isBusy = processingHash === record.p_hash;
                const isSmallImage = isImageStudioSmallImage(
                  record.image_width,
                  record.image_height
                );

                return (
                  <article
                    key={record.p_hash}
                    className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)]"
                  >
                    <div className="grid gap-0 lg:grid-cols-2">
                      <div className="border-b border-slate-100 bg-slate-50 lg:border-b-0 lg:border-r">
                        {record.original_image_url ? (
                          <img
                            src={record.original_image_url}
                            alt={record.seo_title || record.slug || 'Original cake image'}
                            className="aspect-square h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex aspect-square items-center justify-center text-sm text-slate-400">
                            No original image
                          </div>
                        )}
                      </div>
                      <div className="border-b border-slate-100 bg-linear-to-br from-violet-50 to-white lg:border-b-0">
                        {record.studio_edited_image_url || (status === 'completed' && record.original_image_url) ? (
                          <img
                            src={record.studio_edited_image_url || record.original_image_url!}
                            alt={`Edited ${record.seo_title || record.slug || 'cake image'}`}
                            className="aspect-square h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex aspect-square flex-col items-center justify-center gap-3 px-6 text-center text-sm text-slate-500">
                            {isBusy || status === 'processing' ? (
                              <LoaderCircle className="size-8 animate-spin text-violet-500" />
                            ) : (
                              <Sparkles className="size-8 text-violet-300" />
                            )}
                            <p>
                              {isBusy || status === 'processing'
                                ? 'Creating edited image…'
                                : 'Edited image will appear here after processing.'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-5 px-5 py-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusPillClasses(
                                status
                              )}`}
                            >
                              {status.replace('_', ' ')}
                            </span>
                            {isSmallImage ? (
                              <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
                                Small image
                              </span>
                            ) : null}
                            {status === 'completed' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                                <CheckCircle2 className="size-3.5" />
                                Ready
                              </span>
                            ) : null}
                            {status === 'failed' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                                <AlertTriangle className="size-3.5" />
                                Needs retry
                              </span>
                            ) : null}
                          </div>
                          <h2 className="mt-3 text-xl font-semibold text-slate-900">
                            {record.seo_title || record.slug || 'Untitled cache row'}
                          </h2>
                          <p className="mt-1 text-sm text-slate-500">{record.slug || 'No slug yet'}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void processSingleRecord(record)}
                          disabled={isBusy || autoProcessing || !record.original_image_url}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {isBusy ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : (
                            <WandSparkles className="size-4" />
                          )}
                          {status === 'completed' ? 'Re-run edit' : 'Edit image'}
                        </button>
                      </div>

                      <dl className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Price
                          </dt>
                          <dd className="mt-2 font-medium text-slate-900">{formatCurrency(record.price)}</dd>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Availability
                          </dt>
                          <dd className="mt-2 font-medium text-slate-900">
                            {record.availability || '—'}
                          </dd>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Created
                          </dt>
                          <dd className="mt-2 font-medium text-slate-900">
                            {formatDate(record.created_at)}
                          </dd>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Last edited
                          </dt>
                          <dd className="mt-2 font-medium text-slate-900">
                            {formatDate(record.studio_edited_at)}
                          </dd>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Dimensions
                          </dt>
                          <dd className="mt-2 font-medium text-slate-900">
                            {record.image_width && record.image_height
                              ? `${record.image_width} × ${record.image_height}`
                              : 'Unknown'}
                          </dd>
                        </div>
                      </dl>

                      <div className="rounded-2xl bg-slate-50 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Keywords
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {record.keywords || 'No cached keywords'}
                        </p>
                      </div>

                      {record.studio_edit_error ? (
                        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                          <p className="font-semibold">Last error</p>
                          <p className="mt-2 leading-6">{record.studio_edit_error}</p>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-3">
                        {record.studio_edited_image_url || (status === 'completed' && record.original_image_url) ? (
                          <a
                            href={record.studio_edited_image_url || record.original_image_url!}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                          >
                            <ExternalLink className="size-4" />
                            Open edited image
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleCopyHash(record.p_hash)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <Copy className="size-4" />
                          Copy hash
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                disabled={page <= 1 || loading}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setPage((currentPage) => Math.min(totalPages, currentPage + 1))
                }
                disabled={page >= totalPages || loading}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
