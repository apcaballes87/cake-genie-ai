import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('SEO image upload boundaries', () => {
  it.each([
    'src/lib/imageVariants/storage.ts',
    'src/lib/admin/imageStudioJob.ts',
    'src/lib/admin/imageStudioBatch.ts',
    'src/services/shareService.ts',
    'src/services/supabaseService.ts',
  ])('opts the approved public crawler-image path into indexing: %s', (relativePath) => {
    expect(readSource(relativePath)).toContain('getSeoImageUploadHeaders()');
  });

  it.each([
    'src/contexts/CartContext.tsx',
    'src/components/ChatModal.tsx',
    'src/app/customizing/uploadAiChatReferenceImage.ts',
    'src/services/icingMaskService.ts',
    'src/lib/admin/searchAnalysisBatch.ts',
  ])('does not opt a private or temporary upload module into indexing: %s', (relativePath) => {
    expect(readSource(relativePath)).not.toContain('getSeoImageUploadHeaders');
  });

  it('keeps the image-studio mask upload outside the SEO header option', () => {
    const source = readSource('src/lib/admin/imageStudioBatch.ts');
    const maskUpload = source.match(/upload\(path, png,[\s\S]{0,180}?\);/)?.[0];

    expect(maskUpload).toBeDefined();
    expect(maskUpload).not.toContain('getSeoImageUploadHeaders');
  });

  it('keeps payment-proof uploads outside the SEO header option', () => {
    const source = readSource('src/services/supabaseService.ts');
    const paymentProofUpload = source.match(/upload\(filePath, compressedFile,[\s\S]{0,220}?\);/)?.[0];

    expect(paymentProofUpload).toBeDefined();
    expect(paymentProofUpload).not.toContain('getSeoImageUploadHeaders');
  });
});
