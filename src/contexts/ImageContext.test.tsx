// @vitest-environment jsdom
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageProvider, useImageManagement } from './ImageContext';

const {
  dismissToastMock,
  fileToBase64Mock,
  validateCakeImageMock,
  analyzeCakeFeaturesOnlyMock,
  triggerStudioEditFromUploadMock,
  compressImageMock,
  findSimilarAnalysisByHashMock,
  cacheAnalysisResultMock,
  prepareStudioEditCacheRowMock,
  generateServerImageFingerprintMock,
  toFingerprintLookupMock,
  showErrorMock,
  showStatusMock,
} = vi.hoisted(() => ({
  dismissToastMock: vi.fn(),
  fileToBase64Mock: vi.fn(),
  validateCakeImageMock: vi.fn(),
  analyzeCakeFeaturesOnlyMock: vi.fn(),
  triggerStudioEditFromUploadMock: vi.fn(),
  compressImageMock: vi.fn(),
  findSimilarAnalysisByHashMock: vi.fn(),
  cacheAnalysisResultMock: vi.fn(),
  prepareStudioEditCacheRowMock: vi.fn(),
  generateServerImageFingerprintMock: vi.fn(),
  toFingerprintLookupMock: vi.fn(),
  showErrorMock: vi.fn(),
  showStatusMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    dismiss: dismissToastMock,
  },
}));

vi.mock('@/services/geminiService', () => ({
  fileToBase64: fileToBase64Mock,
  validateCakeImage: validateCakeImageMock,
  analyzeCakeFeaturesOnly: analyzeCakeFeaturesOnlyMock,
  enrichAnalysisWithRoboflow: vi.fn(),
  triggerStudioEditFromUpload: triggerStudioEditFromUploadMock,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn(),
    storage: { from: vi.fn() },
  }),
}));

vi.mock('@/lib/utils/imageOptimization', () => ({
  compressImage: compressImageMock,
  dataURItoBlob: () => new Blob(['image'], { type: 'image/png' }),
}));

vi.mock('@/lib/utils/toast', () => ({
  showSuccess: vi.fn(),
  showError: showErrorMock,
  showLoading: vi.fn(),
  showStatus: showStatusMock,
}));

vi.mock('@/services/supabaseService', () => ({
  findSimilarAnalysisByHash: findSimilarAnalysisByHashMock,
  cacheAnalysisResult: cacheAnalysisResultMock,
  prepareStudioEditCacheRow: prepareStudioEditCacheRowMock,
}));

vi.mock('@/lib/utils/analysisUtils', () => ({
  hasBoundingBoxData: () => true,
}));

vi.mock('@/lib/utils/urlHelpers', () => ({
  generateCakeAnalysisSlug: () => 'generated-slug',
}));

vi.mock('@/lib/utils/serverFingerprint.client', () => ({
  generateServerImageFingerprint: generateServerImageFingerprintMock,
  toFingerprintLookup: toFingerprintLookupMock,
}));

vi.mock('@/config/features', () => ({
  FEATURE_FLAGS: {
    USE_ROBOFLOW_COORDINATES: false,
  },
}));

vi.mock('@/lib/utils/storage', () => ({
  getFromIndexedDB: vi.fn().mockResolvedValue(null),
  saveToIndexedDB: vi.fn().mockResolvedValue(undefined),
  removeFromIndexedDB: vi.fn().mockResolvedValue(undefined),
  clearIndexedDB: vi.fn().mockResolvedValue(undefined),
}));

describe('ImageContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ImageProvider>{children}</ImageProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    fileToBase64Mock.mockResolvedValue({
      data: 'uploaded-base64',
      mimeType: 'image/png',
    });
    validateCakeImageMock.mockResolvedValue('valid_single_cake');
    compressImageMock.mockImplementation(async (file: File) => file);
    findSimilarAnalysisByHashMock.mockResolvedValue(null);
    generateServerImageFingerprintMock.mockResolvedValue({
      pHash: 'abc123def4567890',
      pipeline: 'v2-test-pipeline',
      error: null,
    });
    toFingerprintLookupMock.mockReturnValue({
      pHash: 'abc123def4567890',
      pipeline: 'v2-test-pipeline',
    });
    analyzeCakeFeaturesOnlyMock.mockResolvedValue({
      cakeType: 'Bento',
      cakeThickness: '4 in',
      keyword: 'purple cake',
      icing_design: {
        base: 'soft_icing',
        colors: { side: '#FFFFFF', top: '#FFFFFF' },
      },
      main_toppers: [],
      support_elements: [],
      cake_messages: [],
    });
    triggerStudioEditFromUploadMock.mockResolvedValue(true);
    prepareStudioEditCacheRowMock.mockResolvedValue({
      id: 'early-cache-row-123',
      storedPHash: 'abc123def4567890',
      shouldTriggerStudioEdit: true,
      studioTriggerHandled: false,
    });
    cacheAnalysisResultMock.mockResolvedValue({
      id: 'cache-row-123',
      storedPHash: 'abc123def4567890',
      slug: 'generated-slug',
      seo_title: 'Generated Slug',
      price: 999,
      original_image_url: 'https://example.com/original.webp',
    });
  });

  it('starts Studio setup while cake analysis is still pending for a valid cake', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useImageManagement(), { wrapper });
    let resolveAnalysis: (value: unknown) => void = () => { /* replaced below */ };

    analyzeCakeFeaturesOnlyMock.mockReturnValue(new Promise(resolve => {
      resolveAnalysis = resolve;
    }));
    triggerStudioEditFromUploadMock.mockResolvedValue(true);

    let uploadPromise: Promise<void> = Promise.resolve();
    await act(async () => {
      uploadPromise = result.current.handleImageUpload(
        new File(['image-bytes'], 'cake.png', { type: 'image/png' }),
        onSuccess,
        onError
      );
      await Promise.resolve();
    });

    expect(prepareStudioEditCacheRowMock).toHaveBeenCalledWith('abc123def4567890', {
      fingerprintPipeline: 'v2-test-pipeline',
      originalImageUrl: null,
    });
    expect(triggerStudioEditFromUploadMock).toHaveBeenCalledWith(
      'abc123def4567890',
      expect.objectContaining({
        data: 'uploaded-base64',
        mimeType: 'image/png',
      })
    );
    expect(onSuccess).not.toHaveBeenCalled();

    resolveAnalysis({
      cakeType: 'Bento',
      cakeThickness: '4 in',
      keyword: 'purple cake',
      icing_design: {
        base: 'soft_icing',
        colors: { side: '#FFFFFF', top: '#FFFFFF' },
      },
      main_toppers: [],
      support_elements: [],
      cake_messages: [],
    });

    await act(async () => {
      await uploadPromise;
    });

    expect(prepareStudioEditCacheRowMock).toHaveBeenCalledWith('abc123def4567890', {
      fingerprintPipeline: 'v2-test-pipeline',
      originalImageUrl: null,
    });
    expect(triggerStudioEditFromUploadMock).toHaveBeenCalledWith(
      'abc123def4567890',
      expect.objectContaining({
        data: 'uploaded-base64',
        mimeType: 'image/png',
      })
    );
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      keyword: 'purple cake',
    }));
    expect(cacheAnalysisResultMock).toHaveBeenCalledWith(
      'abc123def4567890',
      expect.objectContaining({ keyword: 'purple cake' }),
      undefined,
      expect.any(Blob),
      expect.objectContaining({
        fingerprintPipeline: 'v2-test-pipeline',
        triggerStudioEdit: false,
      })
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it('rejects invalid validation classifications before cache hits or Studio startup', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    validateCakeImageMock.mockResolvedValue('multiple_cakes');
    findSimilarAnalysisByHashMock.mockResolvedValue({
      id: 'cached-row',
      pHash: 'cached-phash',
      analysisResult: { keyword: 'cached cake' },
      seoMetadata: null,
    });

    const { result } = renderHook(() => useImageManagement(), { wrapper });

    await act(async () => {
      await result.current.handleImageUpload(
        new File(['image-bytes'], 'catalog.png', { type: 'image/png' }),
        onSuccess,
        onError
      );
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      message: 'AI_REJECTION: Please upload a single cake image. This image contains multiple cakes.',
    }));
    expect(findSimilarAnalysisByHashMock).not.toHaveBeenCalled();
    expect(analyzeCakeFeaturesOnlyMock).not.toHaveBeenCalled();
    expect(prepareStudioEditCacheRowMock).not.toHaveBeenCalled();
    expect(triggerStudioEditFromUploadMock).not.toHaveBeenCalled();
  });

  it('does not schedule a delayed cache-write studio trigger when prepare already handled Studio', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useImageManagement(), { wrapper });

    prepareStudioEditCacheRowMock.mockResolvedValue({
      id: 'already-handled-cache-row',
      storedPHash: 'abc123def4567890',
      shouldTriggerStudioEdit: false,
      studioTriggerHandled: true,
    });

    await act(async () => {
      await result.current.handleImageUpload(
        new File(['image-bytes'], 'cake.png', { type: 'image/png' }),
        onSuccess,
        onError
      );
    });

    expect(triggerStudioEditFromUploadMock).not.toHaveBeenCalled();
    expect(cacheAnalysisResultMock).toHaveBeenCalledWith(
      'abc123def4567890',
      expect.objectContaining({ keyword: 'purple cake' }),
      undefined,
      expect.any(Blob),
      expect.objectContaining({
        fingerprintPipeline: 'v2-test-pipeline',
        triggerStudioEdit: false,
      })
    );
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      keyword: 'purple cake',
    }));
    expect(onError).not.toHaveBeenCalled();
  });

  it('allows the cache-write studio trigger only when the early upload trigger fails', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useImageManagement(), { wrapper });

    triggerStudioEditFromUploadMock.mockResolvedValue(false);

    await act(async () => {
      await result.current.handleImageUpload(
        new File(['image-bytes'], 'cake.png', { type: 'image/png' }),
        onSuccess,
        onError
      );
    });

    expect(triggerStudioEditFromUploadMock).toHaveBeenCalledWith(
      'abc123def4567890',
      expect.objectContaining({
        data: 'uploaded-base64',
        mimeType: 'image/png',
      })
    );
    expect(cacheAnalysisResultMock).toHaveBeenCalledWith(
      'abc123def4567890',
      expect.objectContaining({ keyword: 'purple cake' }),
      undefined,
      expect.any(Blob),
      expect.objectContaining({
        fingerprintPipeline: 'v2-test-pipeline',
        triggerStudioEdit: true,
      })
    );
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      keyword: 'purple cake',
    }));
    expect(onError).not.toHaveBeenCalled();
  });

  it('stores the live cache row id after a fresh upload cache write resolves', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useImageManagement(), { wrapper });

    await act(async () => {
      await result.current.handleImageUpload(
        new File(['image-bytes'], 'cake.png', { type: 'image/png' }),
        onSuccess,
        onError
      );
    });

    await waitFor(() => {
      expect(result.current.currentCacheId).toBe('cache-row-123');
    });

    expect(result.current.currentPHash).toBe('abc123def4567890');
    expect(findSimilarAnalysisByHashMock).toHaveBeenCalledWith({
      pHash: 'abc123def4567890',
      pipeline: 'v2-test-pipeline',
    }, undefined);
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      keyword: 'purple cake',
    }));
    expect(onError).not.toHaveBeenCalled();
  });

  it('intercepts selfie rejection and converts it into a composite edible photo cake', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useImageManagement(), { wrapper });

    // Mock analyzeCakeFeaturesOnly to return a selfie rejection
    validateCakeImageMock.mockResolvedValue('edible_photo_reference');
    analyzeCakeFeaturesOnlyMock.mockResolvedValue({
      cakeType: '',
      cakeThickness: '',
      keyword: '',
      icing_design: { base: 'soft_icing', colors: { side: '', top: '' } },
      main_toppers: [],
      support_elements: [],
      cake_messages: [],
      rejection: {
        isRejected: true,
        reason: 'selfie',
        message: 'This is a selfie or portrait photo of humans. Let\'s make an edible photo cake!'
      }
    });

    // Mock fetch for image download and cold-cake-edit composite endpoint
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url: any, init?: any) => {
      if (typeof url === 'string' && url.includes('6in-1layer-cake.webp')) {
        const dummyBlob = {
          type: 'image/webp',
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        };
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(dummyBlob),
        } as any);
      }
      if (typeof url === 'string' && url.includes('/api/ai/cold-cake-edit')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            mimeType: 'image/webp',
            imageData: 'composite-image-base64-data',
          }),
        } as any);
      }
      return Promise.resolve({ ok: false } as any);
    });

    await act(async () => {
      await result.current.handleImageUpload(
        new File(['selfie-bytes'], 'my_selfie.png', { type: 'image/png' }),
        onSuccess,
        onError
      );
    });

    await waitFor(() => {
      expect(result.current.editedImage).toBe('data:image/webp;base64,composite-image-base64-data');
      expect(result.current.originalImagePreview).toBe('data:image/webp;base64,composite-image-base64-data');
      expect(result.current.sourceImageData?.data).toBe('uploaded-base64');
      expect(result.current.isComposingSelfie).toBe(false);
    });

    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      keyword: 'Edible Photo',
      main_toppers: expect.arrayContaining([
        expect.objectContaining({
          type: 'edible_photo_top',
          group_id: 'selfie_photo_print',
        })
      ]),
    }));
    expect(prepareStudioEditCacheRowMock).not.toHaveBeenCalled();
    expect(triggerStudioEditFromUploadMock).not.toHaveBeenCalled();
    expect(cacheAnalysisResultMock).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('shows the base cake placeholder immediately and flips isComposingSelfie while the composite is in flight', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useImageManagement(), { wrapper });

    analyzeCakeFeaturesOnlyMock.mockResolvedValue({
      cakeType: '',
      cakeThickness: '',
      keyword: '',
      icing_design: { base: 'soft_icing', colors: { side: '', top: '' } },
      main_toppers: [],
      support_elements: [],
      cake_messages: [],
      rejection: {
        isRejected: true,
        reason: 'selfie',
        message: 'This is a selfie or portrait photo of humans. Let\'s make an edible photo cake!'
      }
    });

    let resolveComposite: (value: Response) => void = () => { /* replaced in mock */ };
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url: any, init?: any) => {
      if (typeof url === 'string' && url.includes('6in-1layer-cake.webp')) {
        const dummyBlob = {
          type: 'image/webp',
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        };
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(dummyBlob),
        } as any);
      }
      if (typeof url === 'string' && url.includes('/api/ai/cold-cake-edit')) {
        return new Promise<Response>((resolve) => {
          resolveComposite = resolve;
        }) as unknown as Promise<Response>;
      }
      return Promise.resolve({ ok: false } as any);
    });

    await act(async () => {
      await result.current.handleImageUpload(
        new File(['selfie-bytes'], 'my_selfie.png', { type: 'image/png' }),
        onSuccess,
        onError
      );
    });

    // While the background composite is still pending, the placeholder cake should
    // be visible in the hero, onSuccess should already have fired, and the
    // isComposingSelfie flag should be true.
    await waitFor(() => {
      expect(result.current.editedImage?.startsWith('data:image/webp;base64,')).toBe(true);
      expect(result.current.isComposingSelfie).toBe(true);
    });

    expect(result.current.sourceImageData?.data).toBe('uploaded-base64');
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      keyword: 'Edible Photo',
    }));
    expect(onError).not.toHaveBeenCalled();

    // Now resolve the composite and verify the placeholder is silently swapped
    // for the composite image, and the spinner flag clears.
    await act(async () => {
      resolveComposite({
        ok: true,
        json: () => Promise.resolve({
          mimeType: 'image/webp',
          imageData: 'composite-image-base64-data',
        }),
      } as unknown as Response);
    });

    await waitFor(() => {
      expect(result.current.editedImage).toBe('data:image/webp;base64,composite-image-base64-data');
      expect(result.current.isComposingSelfie).toBe(false);
    });

    fetchSpy.mockRestore();
  });

  it('shows a friendly quota toast (and skips the generic cake rejection) when the background composite returns 429', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useImageManagement(), { wrapper });

    analyzeCakeFeaturesOnlyMock.mockResolvedValue({
      cakeType: '',
      cakeThickness: '',
      keyword: '',
      icing_design: { base: 'soft_icing', colors: { side: '', top: '' } },
      main_toppers: [],
      support_elements: [],
      cake_messages: [],
      rejection: {
        isRejected: true,
        reason: 'selfie',
        message: 'This is a selfie or portrait photo of humans. Let\'s make an edible photo cake!'
      }
    });

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url: any, init?: any) => {
      if (typeof url === 'string' && url.includes('6in-1layer-cake.webp')) {
        const dummyBlob = {
          type: 'image/webp',
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        };
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(dummyBlob),
        } as any);
      }
      if (typeof url === 'string' && url.includes('/api/ai/cold-cake-edit')) {
        return Promise.resolve({
          ok: false,
          status: 429,
          json: () => Promise.resolve({
            error: 'AI image editing is temporarily unavailable due to quota limits. Please try again later.'
          }),
        } as any);
      }
      return Promise.resolve({ ok: false } as any);
    });

    await act(async () => {
      await result.current.handleImageUpload(
        new File(['selfie-bytes'], 'my_selfie.png', { type: 'image/png' }),
        onSuccess,
        onError
      );
    });

    // The user should already be in the customizing workspace with the placeholder
    // cake visible. The 429 from the background composite is surfaced as a toast
    // (NOT onError) since the user has already moved past the upload phase.
    await waitFor(() => {
      expect(result.current.isComposingSelfie).toBe(false);
      expect(showErrorMock).toHaveBeenCalled();
    });

    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      keyword: 'Edible Photo',
    }));
    expect(onError).not.toHaveBeenCalled();
    expect(showErrorMock).toHaveBeenCalledTimes(1);
    expect(showErrorMock.mock.calls[0][0]).toMatch(/getting a lot of cake designs/i);
    expect(dismissToastMock).toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('shows a soft retry toast (and skips the generic cake rejection) when the background composite returns a non-429 error', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useImageManagement(), { wrapper });

    analyzeCakeFeaturesOnlyMock.mockResolvedValue({
      cakeType: '',
      cakeThickness: '',
      keyword: '',
      icing_design: { base: 'soft_icing', colors: { side: '', top: '' } },
      main_toppers: [],
      support_elements: [],
      cake_messages: [],
      rejection: {
        isRejected: true,
        reason: 'selfie',
        message: 'This is a selfie or portrait photo of humans. Let\'s make an edible photo cake!'
      }
    });

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url: any, init?: any) => {
      if (typeof url === 'string' && url.includes('6in-1layer-cake.webp')) {
        const dummyBlob = {
          type: 'image/webp',
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        };
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(dummyBlob),
        } as any);
      }
      if (typeof url === 'string' && url.includes('/api/ai/cold-cake-edit')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'internal error' }),
        } as any);
      }
      return Promise.resolve({ ok: false } as any);
    });

    await act(async () => {
      await result.current.handleImageUpload(
        new File(['selfie-bytes'], 'my_selfie.png', { type: 'image/png' }),
        onSuccess,
        onError
      );
    });

    await waitFor(() => {
      expect(result.current.isComposingSelfie).toBe(false);
      expect(showErrorMock).toHaveBeenCalled();
    });

    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      keyword: 'Edible Photo',
    }));
    expect(onError).not.toHaveBeenCalled();
    expect(showErrorMock).toHaveBeenCalledTimes(1);
    expect(showErrorMock.mock.calls[0][0]).toMatch(/Couldn't add your photo/i);
    expect(showErrorMock.mock.calls[0][0]).not.toMatch(/getting a lot of cake designs/i);

    fetchSpy.mockRestore();
  });

  it('falls back to the standard cake rejection when the placeholder cake itself cannot be fetched', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useImageManagement(), { wrapper });

    analyzeCakeFeaturesOnlyMock.mockResolvedValue({
      cakeType: '',
      cakeThickness: '',
      keyword: '',
      icing_design: { base: 'soft_icing', colors: { side: '', top: '' } },
      main_toppers: [],
      support_elements: [],
      cake_messages: [],
      rejection: {
        isRejected: true,
        reason: 'selfie',
        message: 'This is a selfie or portrait photo of humans. Let\'s make an edible photo cake!'
      }
    });

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url: any, init?: any) => {
      if (typeof url === 'string' && url.includes('6in-1layer-cake.webp')) {
        return Promise.reject(new Error('Network down'));
      }
      return Promise.resolve({ ok: false } as any);
    });

    await act(async () => {
      await result.current.handleImageUpload(
        new File(['selfie-bytes'], 'my_selfie.png', { type: 'image/png' }),
        onSuccess,
        onError
      );
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toMatch(/doesn't appear to be a cake/);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(showErrorMock).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
