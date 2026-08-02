export const CHATBOT_INPUT_MAX_LENGTH = 2_000;
export const CHATBOT_OUTPUT_MAX_LENGTH = 1_000;
export const CHATBOT_HISTORY_LIMIT = 12;

export type ChatbotOutcome = 'answer' | 'clarify' | 'handoff' | 'refuse';

export type ChatbotIntent =
  | 'business_hours'
  | 'address'
  | 'contact'
  | 'pricing'
  | 'delivery'
  | 'customizer_help'
  | 'availability'
  | 'order_account'
  | 'payment'
  | 'refund_cancellation'
  | 'complaint'
  | 'allergy_dietary'
  | 'custom_feasibility'
  | 'human_request'
  | 'prompt_injection'
  | 'general';

export type ChatbotLanguage = 'en' | 'fil' | 'ceb';

export type ChatPageKind =
  | 'customizer'
  | 'merchant_product'
  | 'shared_design'
  | 'price_list'
  | 'delivery_rates'
  | 'contact'
  | 'faq'
  | 'how_to_order'
  | 'other';

export type ChatPageAddOn = {
  kind: 'main_topper' | 'support_element' | 'cake_message';
  type: string;
  description: string;
  size: string | null;
  subtype: string | null;
  quantity: number | null;
  text: string | null;
};

export type ChatPageSelection = {
  cakeType: string;
  cakeSize: string;
  cakeThickness: string;
  icingBase: 'soft_icing' | 'fondant' | null;
  flavors: string[];
  icingFeatures: {
    drip: boolean;
    gumpasteBaseBoard: boolean;
  };
  enabledAddOns: ChatPageAddOn[];
};

export type ChatPageContext = {
  pageKind: ChatPageKind;
  pathname: string;
  designSlug: string | null;
  merchantProductId: string | null;
  selection: ChatPageSelection | null;
};

export type ChatbotFact = {
  id: string;
  text: string;
};

export type ChatbotAssistantResult = {
  outcome: ChatbotOutcome;
  intent: ChatbotIntent;
  language: ChatbotLanguage;
  answer: string;
  sourceIds: string[];
  confidence: number;
  safetyFlags: string[];
  handoffReason: string | null;
};

export type ChatbotRunRecord = {
  id: string;
  conversation_id: string;
  customer_message_id: string;
  status: string;
};
