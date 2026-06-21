import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ChatGptCakeDesignQuoteClient from './ChatGptCakeDesignQuoteClient';

const {
  clearIndexedDbMock,
  dismissMock,
  pushMock,
  showLoadingMock,
  storageMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  clearIndexedDbMock: vi.fn().mockResolvedValue(undefined),
  dismissMock: vi.fn(),
  showLoadingMock: vi.fn(() => 'toast-id'),
  storageMock: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({
        data: { path: 'customizations/mock-upload.png' },
        error: null,
      }),
      getPublicUrl: vi.fn(() => ({
        data: { publicUrl: 'https://cdn.example.com/customizations/mock-upload.png' },
      })),
    })),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    dismiss: dismissMock,
  },
}));

vi.mock('@/components/ImageUploader', () => ({
  ImageUploader: ({
    onImageSelect,
    title,
  }: {
    onImageSelect: (file: File) => void;
    title: string;
  }) => (
    <div>
      <p>{title}</p>
      <button
        type="button"
        onClick={() => onImageSelect(new File(['cake'], 'chatgpt-cake.png', { type: 'image/png' }))}
      >
        Mock upload
      </button>
    </div>
  ),
}));

vi.mock('@/components/landing/LandingFooter', () => ({
  LandingFooter: () => <div>Footer</div>,
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    storage: storageMock,
  }),
}));

vi.mock('@/lib/utils/storage', () => ({
  clearIndexedDB: clearIndexedDbMock,
}));

vi.mock('@/lib/utils/toast', () => ({
  showError: vi.fn(),
  showLoading: showLoadingMock,
}));

describe('ChatGptCakeDesignQuoteClient', () => {
  beforeEach(() => {
    pushMock.mockReset();
    clearIndexedDbMock.mockClear();
    dismissMock.mockClear();
    showLoadingMock.mockClear();
    storageMock.from.mockClear();
  });

  it('uploads through the existing landing handoff and redirects to customizing', async () => {
    render(<ChatGptCakeDesignQuoteClient />);

    expect(screen.getByText(/drop your chatgpt cake image here/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mock upload/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        '/customizing?ref=https%3A%2F%2Fcdn.example.com%2Fcustomizations%2Fmock-upload.png&entry_source=landing',
      );
    });

    expect(clearIndexedDbMock).toHaveBeenCalledTimes(1);
    expect(showLoadingMock).toHaveBeenCalledWith('Uploading your AI cake design...');
    expect(dismissMock).toHaveBeenCalledWith('toast-id');
  });
});
