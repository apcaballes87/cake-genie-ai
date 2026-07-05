import type { AiChatHistoryEntry, CakeInfoUI, CakeMessageUI, IcingDesignUI, MainTopperUI, SupportElementUI, CommerceOrderSnapshot } from '@/types';
import type { CustomizationDetails } from '@/lib/database.types';
import { getLegacyChatHistory } from '@/lib/commerce/aiChatHistory';

interface BuildCartCustomizationDetailsInput {
  cakeInfo: CakeInfoUI;
  mainToppers: MainTopperUI[];
  supportElements: SupportElementUI[];
  cakeMessages: CakeMessageUI[];
  icingDesign: IcingDesignUI | null;
  additionalInstructions: string;
  aiChatHistory: AiChatHistoryEntry[];
  commerceSnapshot: CommerceOrderSnapshot;
}

export function buildCartCustomizationDetails(
  input: BuildCartCustomizationDetailsInput,
): CustomizationDetails {
  return {
    flavors: input.cakeInfo.flavors,
    mainToppers: input.mainToppers
      .filter((topper) => topper.isEnabled)
      .map((topper) => ({
        description: topper.description,
        type: topper.type,
        size: topper.size,
      })),
    supportElements: input.supportElements
      .filter((element) => element.isEnabled)
      .map((element) => ({
        description: element.description,
        type: element.type,
        coverage: element.size,
      })),
    cakeMessages: input.cakeMessages
      .filter((message) => message.isEnabled)
      .map((message) => ({
        text: message.text,
        color: message.color,
      })),
    icingDesign: {
      base: input.icingDesign?.base,
      drip: input.icingDesign?.drip || false,
      gumpasteBaseBoard: input.icingDesign?.gumpasteBaseBoard || false,
      colors: (input.icingDesign?.colors as unknown as Record<string, string>) || {},
    },
    additionalInstructions: input.additionalInstructions,
    ai_chat_history: input.aiChatHistory,
    chat_history: getLegacyChatHistory(input.aiChatHistory),
    commerce_snapshot: input.commerceSnapshot,
  };
}
