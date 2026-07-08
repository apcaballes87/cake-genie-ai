import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavigationProvider, useNavigation } from '@/contexts/NavigationContext';
import { SEARCH_RETURN_STATE_KEY } from '@/lib/searchReturnState';
import { useSmartBack } from './useSmartBack';

const { pushMock } = vi.hoisted(() => ({
    pushMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: pushMock }),
}));

function SmartBackHarness() {
    const { recordNavigation, navigationState } = useNavigation();
    const { goBack } = useSmartBack('customizing');

    return (
        <div>
            <div data-testid="entry-source">{navigationState.entrySource ?? ''}</div>
            <button type="button" onClick={() => recordNavigation('customizing', 'search')}>
                Enter From Search
            </button>
            <button type="button" onClick={() => recordNavigation('customizing', 'direct')}>
                Enter Direct
            </button>
            <button type="button" onClick={goBack}>
                Go Back
            </button>
        </div>
    );
}

describe('useSmartBack', () => {
    beforeEach(() => {
        pushMock.mockReset();
        window.sessionStorage.clear();
        window.history.replaceState({}, '', '/customizing/pink-cake');
        window.sessionStorage.setItem(
            SEARCH_RETURN_STATE_KEY,
            JSON.stringify({
                returnUrl: '/search?q=pink&page=2',
                targetPath: '/customizing/pink-cake',
                query: 'pink',
                scrollY: 900,
                resultCount: 24,
                maxPrice: null,
                selectedColor: null,
                sortBy: 'relevant',
                savedAt: Date.now(),
            }),
        );
    });

    it('returns to the saved search URL when customizing was entered from search', async () => {
        const user = userEvent.setup();

        render(
            <NavigationProvider>
                <SmartBackHarness />
            </NavigationProvider>,
        );

        await user.click(screen.getByRole('button', { name: 'Enter From Search' }));
        await waitFor(() => expect(screen.getByTestId('entry-source')).toHaveTextContent('search'));

        await user.click(screen.getByRole('button', { name: 'Go Back' }));

        expect(pushMock).toHaveBeenCalledWith('/search?q=pink&page=2');
    });

    it('ignores stale search snapshots for direct customizer visits', async () => {
        const user = userEvent.setup();
        window.history.replaceState({}, '', '/customizing/other-cake');

        render(
            <NavigationProvider>
                <SmartBackHarness />
            </NavigationProvider>,
        );

        await user.click(screen.getByRole('button', { name: 'Enter Direct' }));
        await waitFor(() => expect(screen.getByTestId('entry-source')).toHaveTextContent('direct'));

        await user.click(screen.getByRole('button', { name: 'Go Back' }));

        expect(pushMock).toHaveBeenCalledWith('/');
    });

    it('uses the saved search URL when the snapshot target matches the current design path', async () => {
        const user = userEvent.setup();

        render(
            <NavigationProvider>
                <SmartBackHarness />
            </NavigationProvider>,
        );

        await user.click(screen.getByRole('button', { name: 'Enter Direct' }));
        await waitFor(() => expect(screen.getByTestId('entry-source')).toHaveTextContent('direct'));

        await user.click(screen.getByRole('button', { name: 'Go Back' }));

        expect(pushMock).toHaveBeenCalledWith('/search?q=pink&page=2');
    });
});
