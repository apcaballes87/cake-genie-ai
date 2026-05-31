// @vitest-environment jsdom
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageProvider, useImageManagement } from './ImageContext';

const {
  dismissToastMock,
  fileToBase64Mock,
  analyzeCakeFeaturesOnlyMock,
  triggerStudioEditFromUploadMock,
  compressImageMock,
  findSimilarAnalysisByHashMock,
  cacheAnalysisResultMock,
  generateImageFingerprintWithLegacyCandidatesMock,
  generatePerceptualHashCandidatesMock,
  findOrbCacheHitMock,
} = vi.hoisted(() => ({
  dismissToastMock: vi.fn(),
  fileToBase64Mock: vi.fn(),
  analyzeCakeFeaturesOnlyMock: vi.fn(),
  triggerStudioEditFromUploadMock: vi.fn(),
  compressImageMock: vi.fn(),
  findSimilarAnalysisByHashMock: vi.fn(),
  cacheAnalysisResultMock: vi.fn(),
  generateImageFingerprintWithLegacyCandidatesMock: vi.fn(),
  generatePerceptualHashCandidatesMock: vi.fn(),
  findOrbCacheHitMock: vi.fn(),
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
  showError: vi.fn(),
  showLoading: vi.fn(),
  showStatus: vi.fn(),
}));

vi.mock('@/services/supabaseService', () => ({
  findSimilarAnalysisByHash: findSimilarAnalysisByHashMock,
  cacheAnalysisResult: cacheAnalysisResultMock,
}));

vi.mock('@/lib/utils/analysisUtils', () => ({
  hasBoundingBoxData: () => true,
}));

vi.mock('@/lib/utils/urlHelpers', () => ({
  generateCakeAnalysisSlug: () => 'generated-slug',
}));

vi.mock('@/lib/utils/serverFingerprint.client', () => ({
  generateImageFingerprintWithLegacyCandidates: generateImageFingerprintWithLegacyCandidatesMock,
  toFingerprintLookup: vi.fn(),
}));

vi.mock('@/lib/utils/perceptualHash.client', () => ({
  generatePerceptualHashCandidates: generatePerceptualHashCandidatesMock,
}));

vi.mock('@/services/orbMatchingService', () => ({
  findOrbCacheHit: findOrbCacheHitMock,
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
    compressImageMock.mockImplementation(async (file: File) => file);
    findOrbCacheHitMock.mockResolvedValue(null);
    generatePerceptualHashCandidatesMock.mockResolvedValue([]);
    findSimilarAnalysisByHashMock.mockResolvedValue(null);
    generateImageFingerprintWithLegacyCandidatesMock.mockResolvedValue({
      pHash: 'abc123def4567890',
      pipeline: 'v1-test-pipeline',
      legacyPHashCandidates: [],
      error: null,
    });
    analyzeCakeFeaturesOnlyMock.mockResolvedValue({
      cakeType: 'Bento',
      cakeThickness: '4 in',
      keyword: 'purple cake',
      icing_design: {
        base: 'soft_icing',
        colors: { top: '#FFFFFF', side: '#FFFFFF' },
      },
      main_toppers: [],
      support_elements: [],
      cake_messages: [],
    });
    triggerStudioEditFromUploadMock.mockResolvedValue(false);
    cacheAnalysisResultMock.mockResolvedValue({
      id: 'cache-row-123',
      storedPHash: 'abc123def4567890',
      slug: 'generated-slug',
      seo_title: 'Generated Slug',
      price: 999,
      original_image_url: 'https://example.com/original.webp',
    });
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
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      keyword: 'purple cake',
    }));
    expect(onError).not.toHaveBeenCalled();
  });
});
