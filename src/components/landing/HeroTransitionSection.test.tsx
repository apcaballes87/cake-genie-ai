import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroTransitionSection } from './HeroTransitionSection';

vi.mock('next/image', () => ({
    default: (props: Record<string, unknown> & { fill?: unknown; alt?: string }) => {
        const { fill, alt = '', ...imgProps } = props;
        void fill;
        // eslint-disable-next-line @next/next/no-img-element
        return <img alt={alt} {...imgProps} />;
    },
}));

describe('HeroTransitionSection', () => {
    it('renders the split copy and image', () => {
        render(<HeroTransitionSection />);

        const headline = screen.getByText('Give a cake that feels more personal and thoughtful. Available today.');
        expect(screen.getByText('Generic Cakes make generic celebrations.')).toBeInTheDocument();
        expect(headline).toBeInTheDocument();
        expect(headline).toHaveClass('text-[calc(0.5em-1px)]');
        expect(headline).toHaveClass('font-normal');
        expect(headline).toHaveClass('text-purple-300');
        expect(headline).toHaveClass('mx-auto');
        const image = screen.getByAltText('Generic cake compared with a more personal cake');
        expect(image).toBeInTheDocument();
        expect(image.parentElement).toHaveClass('aspect-[21/9]');
    });
});
