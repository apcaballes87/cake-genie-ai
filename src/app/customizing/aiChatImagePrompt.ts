import type { DesignPromptGenerator } from '@/hooks/useDesignUpdate';
import type {
    CakeInfoUI,
    CakeMessageUI,
    IcingDesignUI,
    MainTopperUI,
    SupportElementUI,
} from '@/types';
import {
    buildPrintoutConversionDetail,
    getPrintoutConversionTargets,
} from '@/utils/printoutConversionPrompt';

const AI_CHAT_USER_REQUEST_REGEX = /\[USER REQUEST\]:\s*(.*)/;
const AI_CHAT_NORMALIZED_CHANGES_MARKER = '[NORMALIZED CHANGES]:';

interface AiChatVisualChangeSummaryInput {
    changedPaths: string[];
    cakeInfo: CakeInfoUI;
    icingDesign: IcingDesignUI;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    cakeMessages: CakeMessageUI[];
}

export const buildAiChatVisualChangeSummary = ({
    changedPaths,
    cakeInfo,
    icingDesign,
    mainToppers,
    supportElements,
    cakeMessages,
}: AiChatVisualChangeSummaryInput): string => {
    const changes: string[] = [];
    const hasChangedPath = (prefix: string) => changedPaths.some(path => path === prefix || path.startsWith(`${prefix}.`));

    if (hasChangedPath('cakeInfo')) {
        changes.push(`Use the final cake option: ${cakeInfo.type}, ${cakeInfo.size}, ${cakeInfo.thickness}.`);
    }

    if (hasChangedPath('icingDesign')) {
        changes.push(
            `Use ${icingDesign.base === 'fondant' ? 'fondant' : 'soft icing'} with top color ${icingDesign.colors.top || icingDesign.colors.side}`
            + ` and side color ${icingDesign.colors.side}; drip=${icingDesign.drip}, top border=${icingDesign.border_top}, bottom border=${icingDesign.border_base}, covered board=${icingDesign.gumpasteBaseBoard}.`
        );
    }

    if (hasChangedPath('mainToppers')) {
        const enabledToppers = mainToppers
            .filter(topper => topper.isEnabled)
            .map(topper => `${topper.id}: ${topper.description} (${topper.type})`)
            .join('; ');
        changes.push(`Final enabled main toppers: ${enabledToppers || 'none'}.`);
    }

    if (hasChangedPath('supportElements')) {
        const enabledElements = supportElements
            .filter(element => element.isEnabled)
            .map(element => `${element.id}: ${element.description} (${element.type})`)
            .join('; ');
        changes.push(`Final enabled support elements: ${enabledElements || 'none'}.`);
    }

    if (hasChangedPath('cakeMessages')) {
        const enabledMessages = cakeMessages
            .filter(message => message.isEnabled)
            .map(message => `${message.id}: "${message.text}" at ${message.position} in ${message.color}`)
            .join('; ');
        changes.push(`Final enabled cake messages: ${enabledMessages || 'none'}.`);
    }

    return changes.map(change => `- ${change}`).join('\n');
};

export const buildAiChatImagePrompt: DesignPromptGenerator = (
    _originalAnalysis,
    newCakeInfo,
    mainToppers,
    _supportElements,
    _cakeMessages,
    _icingDesign,
    additionalInstructions,
) => {
    const userRequest = additionalInstructions.match(AI_CHAT_USER_REQUEST_REGEX)?.[1]?.trim()
        ?? additionalInstructions.trim();
    const normalizedChanges = additionalInstructions.includes(AI_CHAT_NORMALIZED_CHANGES_MARKER)
        ? additionalInstructions.split(AI_CHAT_NORMALIZED_CHANGES_MARKER)[1]?.trim()
        : '';

    const printoutConversionTargets = getPrintoutConversionTargets(userRequest, mainToppers);

    const changes = [
        `- **⚡ PRIMARY USER REQUEST (HIGHEST PRIORITY):** ${userRequest}. Apply this user request directly to the cake image.`,
        normalizedChanges
            ? `- **Verified option changes (authoritative):**\n${normalizedChanges}`
            : null,
        ...printoutConversionTargets.map(topper =>
            `- **Material conversion detail:** ${buildPrintoutConversionDetail(topper)}`
        ),
        newCakeInfo?.size ? `- Preserve the final **cake size** as "${newCakeInfo.size}".` : null,
        '- Preserve all other cake details that the user did not mention.',
    ].filter(Boolean).join('\n');

    return `---
### **List of Changes to Apply**
---

${changes}`;
};
