import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomizingHeroPanel } from './CustomizingHeroPanel';

const scrollToMock = vi.fn();

Object.defineProperty(HTMLDivElement.prototype, 'scrollTo', {
    configurable: true,
    value: scrollToMock,
});

Object.defineProperty(HTMLDivElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => 2000,
});

Object.defineProperty(HTMLDivElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 600,
});

vi.mock('@/components/LazyImage', () => ({
    default: ({ src, alt, title, onLoad, onClick, imageClassName }: { src: string; alt: string; title?: string; onLoad?: React.ReactEventHandler<HTMLImageElement>; onClick?: React.MouseEventHandler<HTMLImageElement>; imageClassName?: string }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} title={title} onLoad={onLoad} onClick={onClick} className={imageClassName} />
    ),
}));

vi.mock('../../components/LoadingSpinner', () => ({
    LoadingSpinner: () => <div>loading-spinner</div>,
}));

vi.mock('../../components/icons', () => ({
    CloseIcon: ({ className }: { className?: string }) => <div className={className}>close-icon</div>,
    ErrorIcon: () => <div>error-icon</div>,
    ImageIcon: () => <div>image-icon</div>,
    ResetIcon: ({ className }: { className?: string }) => <div className={className}>reset-icon</div>,
    SaveIcon: ({ className }: { className?: string }) => <div className={className}>save-icon</div>,
    Loader2: ({ className }: { className?: string }) => <div className={className}>loader-icon</div>,
    ReportIcon: ({ className }: { className?: string }) => <div className={className}>report-icon</div>,
}));

const buildProps = (): React.ComponentProps<typeof CustomizingHeroPanel> => ({
    mainImageContainerRef: { current: null },
    editedImage: null,
    activeTab: 'customized',
    isAnalyzing: false,
    isUpdatingDesign: false,
    isStudioBackgroundEditingPending: false,
    dynamicLoadingMessage: 'Working on your cake...',
    error: null,
    originalImagePreview: null,
    preferredOriginalImageUrl: null,
    preloadedHeroImage: null,
    fallbackImageUrl: null,
    fallbackImageAlt: 'Fallback Cake',
    fallbackImageTitle: 'Fallback Cake Title',
    initialCaption: 'Initial caption',
    heroImageAlt: 'Hero cake',
    heroImageTitle: 'Hero cake title',
    showSaveDesignButton: false,
    isCurrentDesignSaved: false,
    canUndo: false,
    isLoading: false,
    isReporting: false,
    showFooterActions: false,
    showPriceGuarantee: false,
    showMotifButton: false,
    onOriginalTabSelect: vi.fn(),
    onCustomizedTabSelect: vi.fn(),
    onToggleSaveDesign: vi.fn(),
    onUndo: vi.fn(),
    onOpenMotifPanel: vi.fn(),
    onOpenReportModal: vi.fn(),
    onUploadCakeDesign: vi.fn(),
    onClearAll: vi.fn(),
});

describe('CustomizingHeroPanel', () => {
    it('hides provider configuration details in the hero error overlay', () => {
        const props = buildProps();
        props.error = 'AI cake analysis is not authorized. Please check the Vertex AI and Workload Identity configuration.';

        render(<CustomizingHeroPanel {...props} />);

        expect(screen.getByText('AI Service Temporarily Offline')).toBeInTheDocument();
        expect(screen.getByText('Please browse or search our cake design gallery while the service recovers.')).toBeInTheDocument();
        expect(screen.queryByText(/Vertex AI/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Workload Identity/i)).not.toBeInTheDocument();
        expect(screen.queryByText('Update Failed')).not.toBeInTheDocument();
    });

    it('renders the empty hero state with disabled report and available upload action', () => {
        const props = buildProps();
        props.showFooterActions = true;

        render(<CustomizingHeroPanel {...props} />);

        expect(screen.getByText('Your creation will appear here')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Report an issue' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Upload Cake Design' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Reset everything' })).toBeInTheDocument();
    });

    it('renders the initial fallback image and caption when preview data is absent', () => {
        const props = buildProps();
        props.fallbackImageUrl = 'https://example.com/fallback-cake.jpg';

        render(<CustomizingHeroPanel {...props} />);

        expect(screen.getByRole('img', { name: 'Fallback Cake' })).toHaveAttribute('src', 'https://example.com/fallback-cake.jpg');
        expect(screen.getByText('Initial caption')).toBeInTheDocument();
        expect(screen.getByText('4.8')).toBeInTheDocument();
        expect(screen.getByText('based on 6 Happy Customers.')).toBeInTheDocument();
        expect(screen.getByText('Verified')).toBeInTheDocument();
        expect(screen.getByText('FREE Delivery within Cebu City')).toBeInTheDocument();
    });

    it('renders preloaded analyzing and update error overlays', () => {
        const props = buildProps();
        props.preloadedHeroImage = 'https://example.com/preloaded-cake.jpg';
        props.isAnalyzing = true;
        props.isUpdatingDesign = true;
        props.error = 'AI_REJECTION: Unsupported image';

        render(<CustomizingHeroPanel {...props} />);

        expect(screen.getByText('Analyzing design elements & pricing...')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Loading cake design...' })).toHaveAttribute('src', 'https://example.com/preloaded-cake.jpg');
        expect(screen.getByText('Analyzing your design...')).toBeInTheDocument();
        expect(screen.getByText('Image Rejected')).toBeInTheDocument();
        expect(screen.getByText('Unsupported image')).toBeInTheDocument();
    });

    it('renders image controls and forwards hero interactions', () => {
        const props = buildProps();
        props.editedImage = 'data:image/png;base64,edited';
        props.originalImagePreview = 'https://example.com/original-cake.jpg';
        props.showSaveDesignButton = true;
        props.canUndo = true;
        props.showFooterActions = true;
        render(<CustomizingHeroPanel {...props} />);

        fireEvent.click(screen.getByRole('button', { name: 'Original' }));
        fireEvent.click(screen.getByRole('button', { name: 'Customized' }));
        fireEvent.load(screen.getByRole('img', { name: 'Hero cake' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save this design' }));
        fireEvent.click(screen.getByRole('button', { name: 'Undo last change' }));
        fireEvent.click(screen.getByRole('button', { name: 'Report an issue' }));
        fireEvent.click(screen.getByRole('button', { name: 'Upload Cake Design' }));
        fireEvent.click(screen.getByRole('button', { name: 'Reset everything' }));

        expect(props.onOriginalTabSelect).toHaveBeenCalledTimes(1);
        expect(props.onCustomizedTabSelect).toHaveBeenCalledTimes(1);
        expect(props.onToggleSaveDesign).toHaveBeenCalledTimes(1);
        expect(props.onUndo).toHaveBeenCalledTimes(1);
        expect(props.onOpenReportModal).toHaveBeenCalledTimes(1);
        expect(props.onUploadCakeDesign).toHaveBeenCalledTimes(1);
        expect(props.onClearAll).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: 'Save this design' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Upload Cake Design' })).toBeInTheDocument();
    });

    it('shows a lower-left loader while the studio background edit is still pending', () => {
        const props = buildProps();
        props.originalImagePreview = 'https://example.com/original-cake.jpg';
        props.preferredOriginalImageUrl = 'https://example.com/original-cake.jpg';
        props.isStudioBackgroundEditingPending = true;

        render(<CustomizingHeroPanel {...props} />);

        expect(screen.getByLabelText('ai is editing your background')).toBeInTheDocument();
    });

    it('does not show the removed icing-mask loader', () => {
        const props = buildProps();
        props.originalImagePreview = 'https://example.com/original-cake.jpg';
        props.preferredOriginalImageUrl = 'https://example.com/original-cake.jpg';

        render(<CustomizingHeroPanel {...props} />);

        expect(screen.queryByLabelText('ai is editing your icing')).not.toBeInTheDocument();
    });

    it('shows a lower-left loader while the selfie composite is being generated', () => {
        const props = buildProps();
        props.editedImage = 'data:image/webp;base64,placeholder-cake';
        props.originalImagePreview = 'https://example.com/original-cake.jpg';
        props.preferredOriginalImageUrl = 'https://example.com/original-cake.jpg';
        props.isComposingSelfie = true;

        render(<CustomizingHeroPanel {...props} />);

        const loader = screen.getByLabelText('ai is adding your image to the cake');
        expect(loader).toBeInTheDocument();
        expect(loader.textContent).toMatch(/ai adding your image on this cake/i);
    });

    it('opens a fullscreen image modal when the hero image is clicked', () => {
        const props = buildProps();
        props.originalImagePreview = 'https://example.com/original-cake.jpg';
        props.preferredOriginalImageUrl = 'https://example.com/original-cake.jpg';

        render(<CustomizingHeroPanel {...props} />);

        fireEvent.click(screen.getByRole('img', { name: 'Hero cake' }));

        expect(screen.getByRole('dialog', { name: 'Full screen image preview' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Close zoomed image' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Close zoomed image' }));

        expect(screen.queryByRole('dialog', { name: 'Full screen image preview' })).not.toBeInTheDocument();
    });

    it('shows a mobile scroll cue when the hero uses the mobile scrollable image mode', () => {
        const props = buildProps();
        props.enableMobileHeroPan = true;
        props.originalImagePreview = 'https://example.com/original-cake.jpg';
        props.preferredOriginalImageUrl = 'https://example.com/original-cake.jpg';
        props.initialHeroAspectRatio = '1 / 2';

        render(<CustomizingHeroPanel {...props} />);

        expect(screen.getByText('Scroll')).toBeInTheDocument();
        expect(screen.getByText('↑')).toBeInTheDocument();
        expect(screen.getByText('↓')).toBeInTheDocument();
    });

    it('starts tall mobile hero images centered instead of at the top', () => {
        const props = buildProps();
        props.enableMobileHeroPan = true;
        props.originalImagePreview = 'https://example.com/original-cake.jpg';
        props.preferredOriginalImageUrl = 'https://example.com/original-cake.jpg';
        props.initialHeroAspectRatio = '1 / 2';

        scrollToMock.mockClear();

        render(<CustomizingHeroPanel {...props} />);
        fireEvent.load(screen.getAllByRole('img', { name: 'Hero cake' })[0]);

        expect(scrollToMock).toHaveBeenCalledWith({
            top: 700,
            behavior: 'auto',
        });
    });

    it('renders stored hero variants as responsive srcset candidates for native LCP images', () => {
        const props = buildProps();
        props.enableMobileHeroPan = true;
        props.originalImagePreview = 'https://example.com/original-cake.jpg';
        props.preferredOriginalImageUrl = 'https://example.com/original-cake.jpg';
        props.initialHeroAspectRatio = '1 / 2';
        props.heroImageVariants = {
            format: 'webp',
            source: 'original_image_url',
            variants: [
                { width: 400, url: 'https://example.com/original-cake-400.webp', bytes: 12_000 },
                { width: 800, url: 'https://example.com/original-cake-800.webp', bytes: 24_000 },
            ],
        };

        render(<CustomizingHeroPanel {...props} />);

        const heroImages = screen.getAllByRole('img', { name: 'Hero cake' });
        expect(heroImages.some((image) => image.getAttribute('srcset')?.includes('original-cake-400.webp 400w'))).toBe(true);
        expect(heroImages.some((image) => image.getAttribute('sizes') === '(max-width: 768px) 100vw, 50vw')).toBe(true);
    });

    it('fills the mobile hero frame for wider images instead of showing the scroll treatment', () => {
        const props = buildProps();
        props.enableMobileHeroPan = true;
        props.originalImagePreview = 'https://example.com/original-cake.jpg';
        props.preferredOriginalImageUrl = 'https://example.com/original-cake.jpg';
        props.initialHeroAspectRatio = '4 / 3';

        render(<CustomizingHeroPanel {...props} />);

        expect(screen.queryByText('Scroll')).not.toBeInTheDocument();
        const heroImages = screen.getAllByRole('img', { name: 'Hero cake' });
        expect(heroImages.some((image) => image.className.includes('object-cover'))).toBe(true);
    });

    it('keeps the original hero frame ratio when a customized AI edit has a wider bitmap', () => {
        const props = buildProps();
        props.activeTab = 'customized';
        props.editedImage = 'data:image/png;base64,wide-edited-cake';
        props.originalImagePreview = 'https://example.com/original-cake.jpg';
        props.preferredOriginalImageUrl = 'https://example.com/original-cake.jpg';
        props.initialHeroAspectRatio = '6 / 5';

        render(<CustomizingHeroPanel {...props} />);

        const frame = screen.getByTestId('customizer-hero-frame');
        expect(frame).toHaveStyle({ aspectRatio: '6 / 5' });

        const editedImage = screen.getByRole('img', { name: 'Hero cake' });
        Object.defineProperty(editedImage, 'naturalWidth', { configurable: true, value: 1600 });
        Object.defineProperty(editedImage, 'naturalHeight', { configurable: true, value: 900 });

        fireEvent.load(editedImage);

        expect(frame).toHaveStyle({ aspectRatio: '6 / 5' });
    });

    it('swaps to the preferred original image after it loads', () => {
        const props = buildProps();
        props.activeTab = 'original';
        props.originalImagePreview = 'https://example.com/original-cake.jpg';
        props.preferredOriginalImageUrl = 'https://example.com/original-cake.jpg';

        const { rerender } = render(<CustomizingHeroPanel {...props} />);

        expect(screen.getByRole('img', { name: 'Hero cake' })).toHaveAttribute('src', 'https://example.com/original-cake.jpg');

        rerender(
            <CustomizingHeroPanel
                {...props}
                preferredOriginalImageUrl="https://example.com/studio-cake.webp"
            />
        );

        const heroImages = screen.getAllByRole('img', { name: 'Hero cake' });
        expect(heroImages.some((image) => image.getAttribute('src') === 'https://example.com/studio-cake.webp')).toBe(true);

        const studioImage = heroImages.find((image) => image.getAttribute('src') === 'https://example.com/studio-cake.webp');
        expect(studioImage).toBeTruthy();

        fireEvent.load(studioImage as HTMLImageElement);

        const postLoadImages = screen.getAllByRole('img', { name: 'Hero cake' });
        expect(postLoadImages.some((image) => image.getAttribute('src') === 'https://example.com/studio-cake.webp')).toBe(true);
    });
});
