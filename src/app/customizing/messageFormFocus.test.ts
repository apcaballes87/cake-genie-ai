import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusCakeMessageForm } from './messageFormFocus';

describe('focusCakeMessageForm', () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    it('scrolls and focuses the visible responsive message input', () => {
        const hiddenInput = document.createElement('textarea');
        hiddenInput.dataset.cakeMessageInputId = 'message-1';
        const visibleInput = document.createElement('textarea');
        visibleInput.dataset.cakeMessageInputId = 'message-1';
        const scrollIntoView = vi.fn();
        visibleInput.scrollIntoView = scrollIntoView;
        Object.defineProperty(visibleInput, 'getClientRects', {
            value: () => [{ width: 100, height: 34 }],
        });
        document.body.append(hiddenInput, visibleInput);

        expect(focusCakeMessageForm('message-1')).toBe(true);
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
        expect(document.activeElement).toBe(visibleInput);
    });

    it('does nothing when the selected message no longer has a form field', () => {
        expect(focusCakeMessageForm('missing-message')).toBe(false);
    });
});
