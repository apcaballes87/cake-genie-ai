import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageZoomModal } from './ImageZoomModal';

vi.mock('./LazyImage', () => ({
    default: ({ src, alt }: { src: string; alt: string }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} />
    ),
}));

const buildProps = (): React.ComponentProps<typeof ImageZoomModal> => ({
    isOpen: true,
    onClose: vi.fn(),
    originalImage: 'https://example.com/original-cake.jpg',
    customizedImage: 'https://example.com/customized-cake.jpg',
    initialTab: 'original',
});

const originalMatchMedia = window.matchMedia;

function mockMatchMedia(matches: boolean) {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(() => ({
            matches,
            media: '(max-width: 767px)',
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
}

describe('ImageZoomModal', () => {
    beforeEach(() => {
        document.head.innerHTML = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">';
    });

    afterEach(() => {
        document.body.className = '';
        document.body.style.overflow = '';
        document.head.innerHTML = '';
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: originalMatchMedia,
        });
    });

    it('renders a visible close button and closes on click', () => {
        mockMatchMedia(true);
        const props = buildProps();

        const { rerender } = render(<ImageZoomModal {...props} />);

        expect(document.body).toHaveClass('genie-image-zoom-open');
        expect(document.querySelector('meta[name="viewport"]')?.getAttribute('content')).toBe(
            'width=device-width, initial-scale=1, viewport-fit=cover',
        );

        fireEvent.click(screen.getByRole('button', { name: 'Close zoomed image' }));

        expect(props.onClose).toHaveBeenCalledTimes(1);

        rerender(<ImageZoomModal {...props} isOpen={false} />);

        expect(document.body).not.toHaveClass('genie-image-zoom-open');
        expect(document.querySelector('meta[name="viewport"]')?.getAttribute('content')).toBe(
            'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
        );
    });

    it('keeps the locked viewport content untouched outside the mobile breakpoint', () => {
        mockMatchMedia(false);
        const props = buildProps();

        render(<ImageZoomModal {...props} />);

        expect(document.querySelector('meta[name="viewport"]')?.getAttribute('content')).toBe(
            'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
        );
    });
});
