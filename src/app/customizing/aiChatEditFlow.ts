import {
    applyAiChatEdit,
    type AiChatAction,
    type AiChatCustomizationSnapshot,
    type AiChatEditResponse,
    type ApplyAiChatEditOptions,
    type ApplyAiChatEditResult,
} from './aiChatEditContract';

export interface ExecuteAiChatEditFlowOptions extends ApplyAiChatEditOptions {
    currentState: AiChatCustomizationSnapshot;
    interpret: () => Promise<AiChatEditResponse>;
    onInterpreted?: (response: AiChatEditResponse) => void | Promise<void>;
    applyState: (result: ApplyAiChatEditResult) => void | Promise<void>;
    editImage: (result: ApplyAiChatEditResult) => Promise<void>;
    runAction: (action: AiChatAction) => void | Promise<void>;
}

export interface ExecuteAiChatEditFlowResult {
    response: AiChatEditResponse;
    editResult: ApplyAiChatEditResult | null;
    effectiveOutcome: AiChatEditResponse['outcome'];
    imageEdited: boolean;
}

export async function executeAiChatEditFlow({
    currentState,
    interpret,
    onInterpreted,
    applyState,
    editImage,
    runAction,
    createId,
}: ExecuteAiChatEditFlowOptions): Promise<ExecuteAiChatEditFlowResult> {
    const response = await interpret();
    await onInterpreted?.(response);

    if (response.outcome === 'restriction' || response.outcome === 'clarification' || response.outcome === 'noop') {
        return {
            response,
            editResult: null,
            effectiveOutcome: response.outcome,
            imageEdited: false,
        };
    }

    if (response.outcome === 'action_only') {
        for (const action of response.actions) {
            await runAction(action);
        }
        return {
            response,
            editResult: null,
            effectiveOutcome: 'action_only',
            imageEdited: false,
        };
    }

    const editResult = applyAiChatEdit(currentState, response, { createId });
    if (editResult.changedPaths.length === 0) {
        return {
            response,
            editResult,
            effectiveOutcome: 'noop',
            imageEdited: false,
        };
    }

    await applyState(editResult);

    if (editResult.requiresImageEdit) {
        await editImage(editResult);
    }

    for (const action of response.actions) {
        await runAction(action);
    }

    return {
        response,
        editResult,
        effectiveOutcome: 'design_change',
        imageEdited: editResult.requiresImageEdit,
    };
}
