import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CartLoginModal from './CartLoginModal';

const mocks = vi.hoisted(() => ({
    signIn: vi.fn(),
    signInWithGoogle: vi.fn(),
    showError: vi.fn(),
    showSuccess: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        signIn: mocks.signIn,
        signInWithGoogle: mocks.signInWithGoogle,
    }),
}));

vi.mock('@/lib/utils/toast', () => ({
    showError: mocks.showError,
    showSuccess: mocks.showSuccess,
}));

describe('CartLoginModal', () => {
    beforeEach(() => {
        mocks.signIn.mockReset();
        mocks.signInWithGoogle.mockReset();
        mocks.showError.mockReset();
        mocks.showSuccess.mockReset();
        document.body.style.overflow = '';
    });

    it('prefills the existing cart email and keeps successful password login in the cart flow', async () => {
        const user = userEvent.setup();
        const onSignedIn = vi.fn();
        mocks.signIn.mockResolvedValue({ error: null });

        render(
            <CartLoginModal
                initialEmail="existing@example.com"
                onClose={vi.fn()}
                onSignedIn={onSignedIn}
            />,
        );

        expect(screen.getByLabelText('Email Address')).toHaveValue('existing@example.com');
        await user.type(screen.getByLabelText('Password'), 'correct-password');
        await user.click(screen.getByRole('button', { name: 'Sign In' }));

        await waitFor(() => expect(mocks.signIn).toHaveBeenCalledWith('existing@example.com', 'correct-password'));
        expect(onSignedIn).toHaveBeenCalledTimes(1);
        expect(mocks.showSuccess).toHaveBeenCalledWith('Welcome back! Your cart is ready.');
    });

    it('sends Google auth back to the cart instead of the homepage', async () => {
        const user = userEvent.setup();
        mocks.signInWithGoogle.mockResolvedValue({ data: {}, error: null });

        render(
            <CartLoginModal
                initialEmail="existing@example.com"
                onClose={vi.fn()}
                onSignedIn={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Continue with Google' }));

        await waitFor(() => expect(mocks.signInWithGoogle).toHaveBeenCalledWith('/cart'));
    });

    it('allows closing without navigating away', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();

        render(
            <CartLoginModal
                initialEmail="existing@example.com"
                onClose={onClose}
                onSignedIn={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Close sign in' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
