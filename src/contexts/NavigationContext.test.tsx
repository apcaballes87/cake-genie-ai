import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { NavigationProvider, useNavigation } from './NavigationContext';

function NavigationHarness() {
    const { navigationState, recordNavigation, getBackDestination } = useNavigation();

    return (
        <div>
            <div data-testid="current-page">{navigationState.currentPage}</div>
            <div data-testid="back-destination">{getBackDestination()}</div>
            <button type="button" onClick={() => recordNavigation('customizing', 'direct')}>
                Record Customizing
            </button>
            <button type="button" onClick={() => recordNavigation('cart', null)}>
                Record Cart
            </button>
        </div>
    );
}

describe('NavigationProvider back destinations', () => {
    beforeEach(() => {
        cleanup();
        window.sessionStorage.clear();
        window.history.replaceState({}, '', '/');
    });

    it('uses Home when the recorded back destination is customizing', async () => {
        const user = userEvent.setup();

        render(
            <NavigationProvider>
                <NavigationHarness />
            </NavigationProvider>
        );

        await user.click(screen.getByRole('button', { name: 'Record Customizing' }));
        await waitFor(() => {
            expect(screen.getByTestId('current-page')).toHaveTextContent('customizing');
        });

        await user.click(screen.getByRole('button', { name: 'Record Cart' }));
        await waitFor(() => {
            expect(screen.getByTestId('current-page')).toHaveTextContent('cart');
        });

        expect(screen.getByTestId('back-destination')).toHaveTextContent('/');
    });
});
