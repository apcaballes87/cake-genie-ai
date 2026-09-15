import type { AiChatHistoryEntry, CakeInfoUI, CakeMessageUI, IcingDesignUI, MainTopperUI, SupportElementUI, CommerceOrderSnapshot } from '@/types';
import type { CustomizationDetails } from '@/lib/database.types';
import type { BasePriceCatalog } from '@/lib/pricing/basePriceCatalog';
import { getLegacyChatHistory } from '@/lib/commerce/aiChatHistory';
import { buildTierFlavorAssignments } from '@/lib/tierFlavorMapping';

interface BuildCartCustomizationDetailsInput {
  cakeInfo: CakeInfoUI;
  mainToppers: MainTopperUI[];
  supportElements: SupportElementUI[];
  cakeMessages: CakeMessageUI[];
  icingDesign: IcingDesignUI | null;
  additionalInstructions: string;
  aiChatHistory: AiChatHistoryEntry[];
  commerceSnapshot: CommerceOrderSnapshot;
  basePriceCatalog?: BasePriceCatalog;
}

export function buildCartCustomizationDetails(
  input: BuildCartCustomizationDetailsInput,
): CustomizationDetails {
  const tierFlavors = buildTierFlavorAssignments(
    input.cakeInfo.type,
    input.cakeInfo.size,
    input.cakeInfo.flavors,
  );

  return {
    flavors: input.cakeInfo.flavors,
    ...(tierFlavors ? { tier_flavors: tierFlavors } : {}),
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
        text: message.text || message.originalMessage?.text || '',
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
    ...(input.basePriceCatalog ? { base_price_catalog: input.basePriceCatalog } : {}),
  };
}
