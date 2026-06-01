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
    default: ({ src, alt, title, onLoad, onClick }: { src: string; alt: string; title?: string; onLoad?: React.ReactEventHandler<HTMLImageElement>; onClick?: React.MouseEventHandler<HTMLImageElement> }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} title={title} onLoad={onLoad} onClick={onClick} />
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
    isSaving: false,
    showFooterActions: false,
    showPriceGuarantee: false,
    showMotifButton: false,
    onOriginalTabSelect: vi.fn(),
    onCustomizedTabSelect: vi.fn(),
    onToggleSaveDesign: vi.fn(),
    onUndo: vi.fn(),
    onOpenMotifPanel: vi.fn(),
    onOpenReportModal: vi.fn(),
    onSave: vi.fn(),
    onClearAll: vi.fn(),
});

describe('CustomizingHeroPanel', () => {
    it('renders the empty hero state with disabled report and save actions', () => {
        const props = buildProps();
        props.showFooterActions = true;

        render(<CustomizingHeroPanel {...props} />);

        expect(screen.getByText('Your creation will appear here')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Report an issue' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Save customized image' })).toBeDisabled();
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
        props.showMotifButton = true;

        render(<CustomizingHeroPanel {...props} />);

        fireEvent.click(screen.getByRole('button', { name: 'Original' }));
        fireEvent.click(screen.getByRole('button', { name: 'Customized' }));
        fireEvent.load(screen.getByRole('img', { name: 'Hero cake' }));
        fireEvent.click(screen.getByRole('button', { name: 'Change Motif Color' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save this design' }));
        fireEvent.click(screen.getByRole('button', { name: 'Undo last change' }));
        fireEvent.click(screen.getByRole('button', { name: 'Report an issue' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save customized image' }));
        fireEvent.click(screen.getByRole('button', { name: 'Reset everything' }));

        expect(props.onOriginalTabSelect).toHaveBeenCalledTimes(1);
        expect(props.onCustomizedTabSelect).toHaveBeenCalledTimes(1);
        expect(props.onOpenMotifPanel).toHaveBeenCalledTimes(1);
        expect(props.onToggleSaveDesign).toHaveBeenCalledTimes(1);
        expect(props.onUndo).toHaveBeenCalledTimes(1);
        expect(props.onOpenReportModal).toHaveBeenCalledTimes(1);
        expect(props.onSave).toHaveBeenCalledTimes(1);
        expect(props.onClearAll).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: 'Save this design' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save customized image' })).toBeInTheDocument();
    });

    it('shows a lower-left loader while the studio background edit is still pending', () => {
        const props = buildProps();
        props.originalImagePreview = 'https://example.com/original-cake.jpg';
        props.preferredOriginalImageUrl = 'https://example.com/original-cake.jpg';
        props.isStudioBackgroundEditingPending = true;

        render(<CustomizingHeroPanel {...props} />);

        expect(screen.getByLabelText('AI background editing in progress')).toBeInTheDocument();
    });

    it('shows a lower-left loader while the icing mask is being generated', () => {
        const props = buildProps();
        props.originalImagePreview = 'https://example.com/original-cake.jpg';
        props.preferredOriginalImageUrl = 'https://example.com/original-cake.jpg';
        props.isGeneratingMask = true;

        render(<CustomizingHeroPanel {...props} />);

        expect(screen.getByLabelText('Icing mask generation in progress')).toBeInTheDocument();
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

        scrollToMock.mockClear();

        render(<CustomizingHeroPanel {...props} />);
        fireEvent.load(screen.getAllByRole('img', { name: 'Hero cake' })[0]);

        expect(scrollToMock).toHaveBeenCalledWith({
            top: 700,
            behavior: 'auto',
        });
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
