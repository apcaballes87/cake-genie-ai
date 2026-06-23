import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FloatingImagePreview } from './FloatingImagePreview';

vi.mock('./LoadingSpinner', () => ({
    LoadingSpinner: () => <div>loading-spinner</div>,
}));

vi.mock('./ImageZoomModal', () => ({
    ImageZoomModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div>image-zoom-modal</div> : null,
}));

vi.mock('./LazyImage', () => ({
    default: ({ src, alt, onLoad }: { src: string; alt: string; onLoad?: React.ReactEventHandler<HTMLImageElement> }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} onLoad={onLoad} />
    ),
}));

vi.mock('./icons', () => ({
    MagicSparkleIcon: ({ className }: { className?: string }) => <div className={className}>magic-sparkle-icon</div>,
    Loader2: ({ className }: { className?: string }) => <div className={className}>loader2-icon</div>,
}));

const buildProps = (): React.ComponentProps<typeof FloatingImagePreview> => ({
    isVisible: true,
    originalImage: 'https://example.com/original-cake.jpg',
    customizedImage: null,
    isLoading: false,
    isUpdatingDesign: false,
    activeTab: 'original',
    onTabChange: vi.fn(),
    isAnalyzing: false,
    analysisResult: null,
    isCustomizationDirty: false,
});

describe('FloatingImagePreview', () => {
    it('renders when visible and opens the image zoom modal', () => {
        const props = buildProps();

        render(<FloatingImagePreview {...props} />);

        expect(screen.getByRole('region', { name: 'Floating Image Preview' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Original' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Customized' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Enlarge image' }));

        expect(screen.getByText('image-zoom-modal')).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Floating Image Preview' })).toHaveAttribute('inert');
    });

    it('renders original and customized pill switches', () => {
        const props = buildProps();
        props.customizedImage = 'https://example.com/customized-cake.jpg';

        render(<FloatingImagePreview {...props} />);

        fireEvent.click(screen.getByRole('button', { name: 'Customized' }));

        expect(props.onTabChange).toHaveBeenCalledWith('customized');
    });

    it('adjusts the floating frame aspect ratio based on the image and clamps it at 3:4', () => {
        const props = buildProps();

        render(<FloatingImagePreview {...props} />);

        const frame = screen.getByTestId('floating-image-frame');
        const image = screen.getByRole('img', { name: 'Original Cake' });

        Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 600 });
        Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 1000 });

        fireEvent.load(image);

        expect(frame).toHaveStyle({ aspectRatio: '0.75' });
    });

    it('minimizes when swiped right and restores when clicked or swiped left', () => {
        const props = buildProps();
        render(<FloatingImagePreview {...props} />);

        const region = screen.getByRole('region', { name: 'Floating Image Preview' });

        // Simulate swipe right to minimize (dx = 100, dy = 0)
        fireEvent.touchStart(region, { touches: [{ clientX: 100, clientY: 50 }] });
        fireEvent.touchMove(region, { touches: [{ clientX: 200, clientY: 50 }] });
        fireEvent.touchEnd(region, { changedTouches: [{ clientX: 200, clientY: 50 }] });

        // Expect translate-x-[calc(100%-1rem)] class indicating minimized state
        expect(region).toHaveClass('translate-x-[calc(100%-1rem)]');

        // Expect the restore overlay to be visible
        const restoreButton = screen.getByRole('button', { name: 'Restore image preview' });
        expect(restoreButton).toBeInTheDocument();

        // Simulate tap on the container/overlay to restore (touchstart -> touchend -> click)
        fireEvent.touchStart(region, { touches: [{ clientX: 100, clientY: 50 }] });
        fireEvent.touchEnd(region, { changedTouches: [{ clientX: 100, clientY: 50 }] });
        fireEvent.click(region);
        expect(region).toHaveClass('translate-x-0');
        expect(screen.queryByRole('button', { name: 'Restore image preview' })).not.toBeInTheDocument();

        // Simulate swipe right again to minimize
        fireEvent.touchStart(region, { touches: [{ clientX: 100, clientY: 50 }] });
        fireEvent.touchMove(region, { touches: [{ clientX: 200, clientY: 50 }] });
        fireEvent.touchEnd(region, { changedTouches: [{ clientX: 200, clientY: 50 }] });
        expect(region).toHaveClass('translate-x-[calc(100%-1rem)]');

        // Simulate swipe left to restore (dx = -100, dy = 0)
        fireEvent.touchStart(region, { touches: [{ clientX: 200, clientY: 50 }] });
        fireEvent.touchMove(region, { touches: [{ clientX: 100, clientY: 50 }] });
        fireEvent.touchEnd(region, { changedTouches: [{ clientX: 100, clientY: 50 }] });
        expect(region).toHaveClass('translate-x-0');
    });

    it('does not minimize if vertical movement is dominant during touch swipe', () => {
        const props = buildProps();
        render(<FloatingImagePreview {...props} />);

        const region = screen.getByRole('region', { name: 'Floating Image Preview' });

        // Simulate diagonal swipe that is mostly vertical (dx = 20, dy = 150)
        fireEvent.touchStart(region, { touches: [{ clientX: 100, clientY: 50 }] });
        fireEvent.touchMove(region, { touches: [{ clientX: 120, clientY: 200 }] });
        fireEvent.touchEnd(region, { changedTouches: [{ clientX: 120, clientY: 200 }] });

        // Expect NOT minimized (should remain translate-x-0)
        expect(region).toHaveClass('translate-x-0');
    });

    it('restores on keyboard Enter/Space event on the overlay', () => {
        const props = buildProps();
        render(<FloatingImagePreview {...props} />);

        const region = screen.getByRole('region', { name: 'Floating Image Preview' });

        // Swipe right to minimize
        fireEvent.touchStart(region, { touches: [{ clientX: 100, clientY: 50 }] });
        fireEvent.touchMove(region, { touches: [{ clientX: 200, clientY: 50 }] });
        fireEvent.touchEnd(region, { changedTouches: [{ clientX: 200, clientY: 50 }] });

        const restoreButton = screen.getByRole('button', { name: 'Restore image preview' });

        // Press Enter key to restore
        fireEvent.keyDown(restoreButton, { key: 'Enter', code: 'Enter' });
        expect(region).toHaveClass('translate-x-0');
    });
});
