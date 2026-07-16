import type { DesignPromptGenerator } from '@/hooks/useDesignUpdate';
import {
    buildPrintoutConversionDetail,
    getPrintoutConversionTargets,
} from '@/utils/printoutConversionPrompt';

const AI_CHAT_USER_REQUEST_REGEX = /\[USER REQUEST\]:\s*(.*)/;

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

    const printoutConversionTargets = getPrintoutConversionTargets(userRequest, mainToppers);

    const changes = [
        `- **⚡ PRIMARY USER REQUEST (HIGHEST PRIORITY):** ${userRequest}. Apply this user request directly to the cake image.`,
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
