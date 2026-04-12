import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CakeToppersOptions } from './CakeToppersOptions';
import type { MainTopperUI, SupportElementUI } from '@/types';

vi.mock('./TopperCard', () => ({
    TopperCard: ({ item, type }: { item: { description: string }, type: 'topper' | 'element' }) => (
        <div data-testid={`${type}-card`}>{item.description}</div>
    ),
}));

const createMainTopper = (overrides: Partial<MainTopperUI> = {}): MainTopperUI => ({
    id: 'topper-1',
    type: 'toy',
    original_type: 'toy',
    description: 'Princess topper',
    size: 'medium',
    quantity: 1,
    group_id: 'group-1',
    classification: 'hero',
    isEnabled: true,
    price: 0,
    ...overrides,
});

const createSupportElement = (overrides: Partial<SupportElementUI> = {}): SupportElementUI => ({
    id: 'support-1',
    type: 'chocolates',
    original_type: 'chocolates',
    description: 'Ferrero cluster',
    size: 'small',
    quantity: 1,
    group_id: 'group-2',
    isEnabled: true,
    price: 0,
    ...overrides,
});

const baseProps: ComponentProps<typeof CakeToppersOptions> = {
    mainToppers: [],
    supportElements: [],
    markerMap: new Map<string, string>(),
    updateMainTopper: vi.fn(),
    updateSupportElement: vi.fn(),
    onTopperImageReplace: vi.fn(),
    onSupportElementImageReplace: vi.fn(),
};

const renderCakeToppersOptions = (overrides: Partial<ComponentProps<typeof CakeToppersOptions>> = {}) => {
    render(<CakeToppersOptions {...baseProps} {...overrides} />);
};

describe('CakeToppersOptions', () => {
    it('renders one single-line summary row per section and opens the clicked section', async () => {
        const user = userEvent.setup();
        const onSectionClick = vi.fn();

        renderCakeToppersOptions({
            mode: 'summary',
            onSectionClick,
            mainToppers: [
                createMainTopper({ description: 'Princess topper', quantity: 2 }),
                createMainTopper({ id: 'topper-2', description: 'Gold crown' }),
                createMainTopper({ id: 'topper-3', description: 'Name sign' }),
            ],
            supportElements: [
                createSupportElement({ description: 'Ferrero cluster', quantity: 3 }),
            ],
        });

        const mainButton = screen.getByRole('button', { name: /Main Toppers \(4\):\s*Princess topper × 2, Gold crown \+1 more/i });
        const supportButton = screen.getByRole('button', { name: /Support Elements \(3\):\s*Ferrero cluster × 3/i });

        expect(mainButton).toBeInTheDocument();
        expect(supportButton).toBeInTheDocument();
        expect(screen.queryByTestId('topper-card')).not.toBeInTheDocument();

        await user.click(mainButton);
        await user.click(supportButton);

        expect(onSectionClick).toHaveBeenNthCalledWith(1, 'main');
        expect(onSectionClick).toHaveBeenNthCalledWith(2, 'support');
    });

    it('shows both summary rows with an empty-state summary when a section has no items', () => {
        renderCakeToppersOptions({
            mode: 'summary',
            mainToppers: [createMainTopper()],
            supportElements: [],
        });

        expect(screen.getByRole('button', { name: /Main Toppers \(1\):\s*Princess topper/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Support Elements \(0\):\s*No items selected/i })).toBeInTheDocument();
    });

    it('filters the detailed view to the requested section', () => {
        renderCakeToppersOptions({
            visibleSections: 'support',
            mainToppers: [createMainTopper()],
            supportElements: [createSupportElement()],
        });

        expect(screen.queryByText('Main Toppers (1)')).not.toBeInTheDocument();
        expect(screen.queryByText('Support Elements (1)')).not.toBeInTheDocument();
        expect(screen.getByTestId('element-card')).toHaveTextContent('Ferrero cluster');
    });
});
