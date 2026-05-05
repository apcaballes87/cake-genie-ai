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
    it('renders the transition copy and image', () => {
        render(<HeroTransitionSection />);

        expect(screen.getByText('Generic Cakes make generic celebrations.')).toBeInTheDocument();
        expect(screen.getByText('Give a cake that feels more personal and thoughtful.')).toBeInTheDocument();
        expect(screen.getByText('Available Today.')).toBeInTheDocument();
        expect(screen.getByAltText('Generic cake compared with a more personal cake')).toBeInTheDocument();
    });
});
