import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

describe('ImageZoomModal', () => {
    it('renders a visible close button and closes on click', () => {
        const props = buildProps();

        const { rerender } = render(<ImageZoomModal {...props} />);

        expect(document.body).toHaveClass('genie-image-zoom-open');

        fireEvent.click(screen.getByRole('button', { name: 'Close zoomed image' }));

        expect(props.onClose).toHaveBeenCalledTimes(1);

        rerender(<ImageZoomModal {...props} isOpen={false} />);

        expect(document.body).not.toHaveClass('genie-image-zoom-open');
    });
});
