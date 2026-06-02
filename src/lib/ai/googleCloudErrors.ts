type StorageOperation = 'list' | 'create' | 'read';

const STORAGE_ROLE_BY_OPERATION: Record<StorageOperation, string> = {
  list: 'roles/storage.objectViewer',
  create: 'roles/storage.objectCreator',
  read: 'roles/storage.objectViewer',
};

const STORAGE_PERMISSION_BY_OPERATION: Record<StorageOperation, string> = {
  list: 'storage.objects.list',
  create: 'storage.objects.create',
  read: 'storage.objects.get',
};

function extractBucket(message: string) {
  return message.match(/buckets\/([^/'"\s)]+)/)?.[1] ?? null;
}

function extractPrincipal(message: string) {
  return message.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g)?.[0] ?? null;
}

function extractPermission(message: string) {
  return message.match(/storage\.objects\.[a-z]+/)?.[0] ?? null;
}

function isGoogleCloudStoragePermissionError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? (error as { code?: unknown }).code : undefined;
  const message = error instanceof Error ? error.message : String(error);
  return code === 403 && message.includes('storage.objects.');
}

export function toActionableGoogleCloudStorageError(error: unknown, operation: StorageOperation) {
  if (!isGoogleCloudStoragePermissionError(error)) return error;

  const message = error instanceof Error ? error.message : String(error);
  const bucket = extractBucket(message);
  const principal = extractPrincipal(message);
  const permission = extractPermission(message) ?? STORAGE_PERMISSION_BY_OPERATION[operation];
  const role = STORAGE_ROLE_BY_OPERATION[operation];
  const scope = bucket ? ` on bucket ${bucket}` : '';
  const principalText = principal ? ` to ${principal}` : '';

  return new Error(
    `Google Cloud Storage access is missing${scope}. The deployed Vercel Vertex runtime identity${principalText} needs ${permission}. ` +
    `Grant ${role}${bucket ? ` on gs://${bucket}` : ' on the batch bucket'} and retry. ` +
    `Vertex AI's own service agent access is not enough here because this app touches the batch bucket directly from the server runtime.`
  );
}
