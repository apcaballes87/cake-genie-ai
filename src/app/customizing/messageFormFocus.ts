const MESSAGE_INPUT_SELECTOR = 'textarea[data-cake-message-input-id]';

/**
 * Finds the rendered message input for an overlay selection. Both responsive
 * customizer layouts may be mounted, so prefer the one that is actually visible.
 */
export function focusCakeMessageForm(messageId: string): boolean {
    if (typeof document === 'undefined') return false;

    const inputs = Array.from(document.querySelectorAll<HTMLTextAreaElement>(MESSAGE_INPUT_SELECTOR))
        .filter((input) => input.dataset.cakeMessageInputId === messageId);
    const input = inputs.find((candidate) => candidate.getClientRects().length > 0) ?? inputs[0];

    if (!input) return false;

    input.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    input.focus({ preventScroll: true });
    return true;
}
