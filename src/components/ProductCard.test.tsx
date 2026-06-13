import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductCard } from './ProductCard';

const {
    pushMock,
    toggleSaveDesignMock,
    isDesignSavedMock,
    useImageManagementMock,
    useCakeCustomizationMock,
} = vi.hoisted(() => ({
    pushMock: vi.fn(),
    toggleSaveDesignMock: vi.fn(),
    isDesignSavedMock: vi.fn(),
    useImageManagementMock: vi.fn(),
    useCakeCustomizationMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: pushMock }),
}));

vi.mock('next/link', () => ({
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
        <a href={href} {...props}>{children}</a>
    ),
}));

vi.mock('@/components/LazyImage', () => ({
    default: ({ alt, src }: { alt: string; src: string }) => (
        <div data-alt={alt} data-src={src} />
    ),
}));

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({ user: null, isAuthenticated: false }),
}));

vi.mock('@/contexts/SavedItemsContext', () => ({
    useSavedItemsActions: () => ({
        toggleSaveDesign: toggleSaveDesignMock,
        isDesignSaved: isDesignSavedMock,
    }),
}));

vi.mock('@/contexts/ImageContext', () => ({
    useImageManagement: () => useImageManagementMock(),
}));

vi.mock('@/contexts/CustomizationContext', () => ({
    useCakeCustomization: () => useCakeCustomizationMock(),
}));

vi.mock('@/lib/utils/toast', () => ({
    showLoading: vi.fn(),
    showError: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
    toast: Object.assign(vi.fn(), {
        success: vi.fn(),
        dismiss: vi.fn(),
    }),
}));

const baseProps = {
    p_hash: 'hash-1',
    original_image_url: 'https://example.com/cake.webp',
    keywords: 'Birthday Cake, Purple',
    price: 1299,
};

describe('ProductCard', () => {
    beforeEach(() => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://cqmhanqnfybyxezhobkx.supabase.co';
        pushMock.mockReset();
        toggleSaveDesignMock.mockReset();
        isDesignSavedMock.mockReset().mockReturnValue(false);
        useImageManagementMock.mockReset().mockImplementation(() => {
            throw new Error('useImageManagement should not be used for slug-linked cards');
        });
        useCakeCustomizationMock.mockReset().mockImplementation(() => {
            throw new Error('useCakeCustomization should not be used for slug-linked cards');
        });
    });

    it('renders slug-linked cards without subscribing to customization or image contexts', () => {
        render(<ProductCard {...baseProps} slug="birthday-cake" />);

        expect(screen.getByRole('link')).toHaveAttribute('href', '/customizing/birthday-cake');
        expect(screen.getByText('Birthday Cake')).toBeInTheDocument();
        expect(useImageManagementMock).not.toHaveBeenCalled();
        expect(useCakeCustomizationMock).not.toHaveBeenCalled();
    });

    it('keeps the no-slug fallback wired to customization and image contexts', () => {
        useImageManagementMock.mockReturnValue({
            handleImageUpload: vi.fn(),
            clearImages: vi.fn(),
        });
        useCakeCustomizationMock.mockReturnValue({
            setIsAnalyzing: vi.fn(),
            setAnalysisError: vi.fn(),
            setPendingAnalysisData: vi.fn(),
            initializeDefaultState: vi.fn(),
            clearCustomization: vi.fn(),
        });

        render(<ProductCard {...baseProps} />);

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText('Birthday Cake')).toBeInTheDocument();
        expect(useImageManagementMock).toHaveBeenCalledTimes(1);
        expect(useCakeCustomizationMock).toHaveBeenCalledTimes(1);
    });

    it('prefers a trimmed studio-edited image URL over the original image URL', () => {
        const { container } = render(
            <ProductCard
                {...baseProps}
                slug="birthday-cake"
                studio_edited_image_url=" https://example.com/studio-edited-cake.webp "
            />,
        );

        const image = container.querySelector('[data-src]');
        expect(image).toHaveAttribute('data-src', 'https://example.com/studio-edited-cake.webp');
    });

    it('falls back to the original image URL when the studio-edited image URL is blank', () => {
        const { container } = render(
            <ProductCard
                {...baseProps}
                slug="birthday-cake"
                studio_edited_image_url="   "
            />,
        );

        const image = container.querySelector('[data-src]');
        expect(image).toHaveAttribute('data-src', 'https://example.com/cake.webp');
    });

    it('appends "Cupcakes" instead of "Cake" for cupcake designs', () => {
        render(
            <ProductCard
                {...baseProps}
                slug="hello-kitty-cupcakes"
                keywords="Hello Kitty"
                analysis_json={{ cakeType: 'Cupcake' }}
            />
        );

        expect(screen.getByText('Hello Kitty Cupcakes')).toBeInTheDocument();
    });

    it('uses the direct first-party image URL for background-only cards when the image is Genie-owned', () => {
        const { getByRole } = render(
            <ProductCard
                {...baseProps}
                slug="birthday-cake"
                backgroundOnly
                original_image_url="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/designs/cake.webp"
            />,
        );

        expect(getByRole('img')).toHaveStyle({
            backgroundImage: 'url(https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/designs/cake.webp)',
        });
    });

    it('keeps external background-only images on the proxy path when no safe direct first-party URL exists', () => {
        const { getByRole } = render(
            <ProductCard
                {...baseProps}
                slug="birthday-cake"
                backgroundOnly
                original_image_url="https://images.example.com/cake.webp"
            />,
        );

        expect(getByRole('img')).toHaveStyle({
            backgroundImage: 'url(/api/proxy-image?url=https%3A%2F%2Fimages.example.com%2Fcake.webp)',
        });
    });
});
