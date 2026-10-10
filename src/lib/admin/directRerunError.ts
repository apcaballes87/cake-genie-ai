export type DirectRerunErrorStage =
  | 'provider'
  | 'analysis_validation'
  | 'image_fetch'
  | 'image_transform'
  | 'database_write'
  | 'unknown';

type ProviderError = {
  code?: number;
  message?: string;
  status?: string;
  raw?: string;
};

const MAX_MESSAGE_LENGTH = 4_000;
const MAX_RAW_LENGTH = 20_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}…`;
}

function errorName(error: unknown) {
  const record = asRecord(error);
  return typeof record?.name === 'string' ? record.name : 'UnknownError';
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return truncate(error.message, MAX_MESSAGE_LENGTH);
  if (typeof error === 'string') return truncate(error, MAX_MESSAGE_LENGTH);

  const record = asRecord(error);
  if (typeof record?.message === 'string') {
    return truncate(record.message, MAX_MESSAGE_LENGTH);
  }

  try {
    return truncate(JSON.stringify(error), MAX_MESSAGE_LENGTH);
  } catch {
    return String(error);
  }
}

function normalizeCode(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }
  return undefined;
}

function normalizeProviderRecord(value: unknown, raw?: string): ProviderError | null {
  const record = asRecord(value);
  if (!record) return null;

  const code = normalizeCode(record.code);
  const message = typeof record.message === 'string' ? record.message : undefined;
  const status = typeof record.status === 'string' ? record.status : undefined;
  if (code === undefined && !message && !status) return null;

  return {
    ...(code === undefined ? {} : { code }),
    ...(message ? { message: truncate(message, MAX_MESSAGE_LENGTH) } : {}),
    ...(status ? { status: truncate(status, 200) } : {}),
    ...(raw ? { raw: truncate(raw, MAX_RAW_LENGTH) } : {}),
  };
}

function parseProviderMessage(message: string): ProviderError | null {
  try {
    const parsed = JSON.parse(message) as unknown;
    const parsedRecord = asRecord(parsed);
    if (parsedRecord?.error) {
      return normalizeProviderRecord(parsedRecord.error, message);
    }
    return normalizeProviderRecord(parsed, message);
  } catch {
    return null;
  }
}

function findProviderError(error: unknown, depth = 0): ProviderError | null {
  if (depth > 4) return null;

  const record = asRecord(error);
  if (record?.error) {
    const direct = normalizeProviderRecord(record.error, typeof record.message === 'string' ? record.message : undefined);
    if (direct) return direct;
  }

  const message = errorMessage(error);
  const parsedMessage = parseProviderMessage(message);
  if (parsedMessage) return parsedMessage;

  if (record?.cause) return findProviderError(record.cause, depth + 1);
  return null;
}

function hasErrorName(error: unknown, names: Set<string>, depth = 0): boolean {
  if (depth > 4) return false;
  const record = asRecord(error);
  if (names.has(errorName(error))) return true;
  return Boolean(record?.cause && hasErrorName(record.cause, names, depth + 1));
}

export function extractDirectRerunProviderError(error: unknown) {
  return findProviderError(error);
}

export function isDirectRerunQuotaError(error: unknown): boolean {
  const provider = findProviderError(error);
  if (
    provider?.code === 429
    || /RESOURCE_EXHAUSTED/i.test(provider?.status ?? '')
  ) {
    return true;
  }

  return /(?:\b429\b|RESOURCE_EXHAUSTED|rate.?limit|quota|too many requests)/i.test(
    errorMessage(error),
  );
}

export function classifyDirectRerunError(error: unknown): {
  stage: DirectRerunErrorStage;
  retryable: boolean;
} {
  const provider = findProviderError(error);
  if (provider) {
    const retryable = provider.code === 429
      || (provider.code !== undefined && provider.code >= 500)
      || /RESOURCE_EXHAUSTED|INTERNAL|UNAVAILABLE|rate.?limit|quota/i.test(
        `${provider.status ?? ''} ${provider.message ?? ''}`,
      );
    return { stage: 'provider', retryable };
  }

  if (hasErrorName(error, new Set(['CakeAnalysisResponseError', 'GeneratedAnalysisContractError']))) {
    return { stage: 'analysis_validation', retryable: false };
  }

  const message = errorMessage(error);
  if (/analysis_json update|rpc\b|returned false/i.test(message)) {
    return { stage: 'database_write', retryable: false };
  }
  if (/convertToWebP|webp|image transform|image conversion/i.test(message)) {
    return { stage: 'image_transform', retryable: false };
  }
  if (/image fetch|fetch failed|image download|exceeds 10MB/i.test(message)) {
    return { stage: 'image_fetch', retryable: false };
  }

  return { stage: 'unknown', retryable: false };
}

export function serializeDirectRerunError(error: unknown): Record<string, unknown> {
  const record = asRecord(error);
  const classification = classifyDirectRerunError(error);
  const provider = extractDirectRerunProviderError(error);
  const rawResponse = typeof record?.rawResponse === 'string'
    ? truncate(record.rawResponse, MAX_RAW_LENGTH)
    : undefined;

  const serialized: Record<string, unknown> = {
    name: errorName(error),
    message: errorMessage(error),
    stage: classification.stage,
    retryable: classification.retryable,
  };

  if (error instanceof Error && error.stack) {
    serialized.stack = truncate(error.stack, MAX_MESSAGE_LENGTH);
  }
  if (provider) serialized.provider_error = provider;
  if (rawResponse) serialized.raw_response = rawResponse;

  if (record?.cause) {
    serialized.cause = serializeDirectRerunError(record.cause);
  }

  return serialized;
}
