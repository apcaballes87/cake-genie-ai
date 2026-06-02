import { describe, expect, it } from 'vitest';

import { toActionableGoogleCloudStorageError } from './googleCloudErrors';

describe('toActionableGoogleCloudStorageError', () => {
  it('rewrites storage list denials into actionable bucket IAM guidance', () => {
    const original = Object.assign(
      new Error(
        "vercel-vertex-ai@project-cf9db8b5-0a4c-4486-b35.iam.gserviceaccount.com does not have storage.objects.list access to the Google Cloud Storage bucket. Permission 'storage.objects.list' denied on resource '//storage.googleapis.com/projects/_/buckets/cakegenie-ai-batch-project-d823a677' (or it may not exist)."
      ),
      { code: 403 },
    );

    const result = toActionableGoogleCloudStorageError(original, 'list');

    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain('vercel-vertex-ai@project-cf9db8b5-0a4c-4486-b35.iam.gserviceaccount.com');
    expect((result as Error).message).toContain('storage.objects.list');
    expect((result as Error).message).toContain('roles/storage.objectViewer');
    expect((result as Error).message).toContain('gs://cakegenie-ai-batch-project-d823a677');
  });

  it('rewrites storage create denials with the writer role hint', () => {
    const original = Object.assign(
      new Error("Permission 'storage.objects.create' denied on resource '//storage.googleapis.com/projects/_/buckets/cakegenie-ai-batch-project-d823a677'."),
      { code: 403 },
    );

    const result = toActionableGoogleCloudStorageError(original, 'create');

    expect((result as Error).message).toContain('storage.objects.create');
    expect((result as Error).message).toContain('roles/storage.objectCreator');
  });

  it('leaves unrelated errors unchanged', () => {
    const original = new Error('something else failed');
    expect(toActionableGoogleCloudStorageError(original, 'read')).toBe(original);
  });
});
