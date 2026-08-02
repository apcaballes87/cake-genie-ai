import type {
  ChatbotAssistantResult,
  ChatbotIntent,
  ChatbotLanguage,
} from './types';
import { CHATBOT_INPUT_MAX_LENGTH, CHATBOT_OUTPUT_MAX_LENGTH } from './types';

type IntentRule = {
  intent: ChatbotIntent;
  patterns: RegExp[];
};

const HANDOFF_RULES: IntentRule[] = [
  {
    intent: 'prompt_injection',
    patterns: [
      /ignore (?:all |the )?(?:previous|prior|system) instructions/i,
      /reveal (?:your |the )?(?:system prompt|hidden instructions|secrets?)/i,
      /developer mode|jailbreak|prompt injection/i,
    ],
  },
  {
    intent: 'human_request',
    patterns: [
      /(?:talk|speak|chat) (?:to|with) (?:a )?(?:human|person|staff|agent)/i,
      /real person|live agent|tawo|staff/i,
    ],
  },
  {
    intent: 'order_account',
    patterns: [
      /(?:my|our) (?:order|account)|order (?:status|number|tracking)|where is my|track (?:my|the) order/i,
      /status sa (?:akong |among )?order|asa na (?:akong |among )?order/i,
    ],
  },
  {
    intent: 'payment',
    patterns: [
      /payment (?:proof|screenshot|confirmation|status)|(?:confirm|check)(?:\s+my|\s+the|\s+this)?\s+(?:gcash\s+)?payment|paid na|nakabayad/i,
      /gcash (?:receipt|reference)|transaction (?:id|reference)/i,
    ],
  },
  {
    intent: 'refund_cancellation',
    patterns: [
      /refund|cancel(?:lation| my order)?|dispute|chargeback|change (?:my|the) order|modify (?:my|the) order/i,
      /ipa-cancel|i-cancel|usbon (?:akong |among )?order/i,
    ],
  },
  {
    intent: 'complaint',
    patterns: [
      /complain|complaint|damaged|wrong (?:cake|order)|late delivery|bad service|not satisfied/i,
      /reklamo|sayop (?:ang |among )?order/i,
    ],
  },
  {
    intent: 'allergy_dietary',
    patterns: [
      /allerg|gluten[- ]?free|nut[- ]?free|dairy[- ]?free|vegan|halal|diabetic|sugar[- ]?free/i,
    ],
  },
  {
    intent: 'custom_feasibility',
    patterns: [
      /can you (?:make|copy|recreate)|is this possible|manual quote|wedding cake|sculpt(?:ed|ure)|complex cake/i,
      /kaya (?:ba|ninyo)|mahimo (?:ba|ninyo)|pwede himuon/i,
    ],
  },
];

const SAFE_RULES: IntentRule[] = [
  { intent: 'business_hours', patterns: [/operating hours|business hours|what time|open (?:today|tomorrow)|close|oras|abri|sirado/i] },
  { intent: 'address', patterns: [/address|location|located|where are you|asa (?:mo|kamo)|map|google maps/i] },
  { intent: 'contact', patterns: [/contact|phone|mobile|number|email|tawag|text|message you/i] },
  { intent: 'delivery', patterns: [/delivery|deliver|shipping|delivery fee|shipping fee|hatod|pila.*delivery/i] },
  { intent: 'customizer_help', patterns: [/customiz|how (?:do|to).*cake|upload.*cake|edit.*cake|change.*(?:size|flavor|icing|topper)|unsaon/i] },
  { intent: 'pricing', patterns: [/how much|price|pricing|price range|starts? at|cost|tagpila|pila|presyo|magkano/i] },
  { intent: 'availability', patterns: [/available|availability|rush|same[- ]?day|today|tomorrow|slot|date|when can/i] },
];

const CEBUANO_MARKERS = /\b(unsa|unsaon|asa|pila|tagpila|mahimo|ninyo|kamo|akong|among|ni nga)\b/i;
const FILIPINO_MARKERS = /\b(magkano|paano|saan|pwede|ba|po|ninyo|namin|akin|order ko)\b/i;
const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/i;
const PHONE_PATTERN = /(?:\+?63|0)?\s*9\d{2}(?:[\s-]?\d){7}\b/i;
const PAYMENT_CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/;
const PRIVATE_REFERENCE_PATTERN = /\b(?:order|transaction|payment|account|reference|ref|tracking|gcash)\s*(?:no\.?|number|id|#)?\s*[:#-]?\s*[A-Z0-9-]{5,}\b/i;
const PRIVATE_ADDRESS_PATTERN = /\b(?:my|our|akong|among)\s+address\b|\b(?:deliver|ship|send|hatod)\s+(?:it\s+)?(?:to|sa)\s+(?:unit|house|lot|block|street|st\.|road|rd\.|barangay|brgy\.?|purok)\b/i;

export function normalizeCustomerMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').trim();
  if (!normalized) return null;
  return normalized.slice(0, CHATBOT_INPUT_MAX_LENGTH);
}

export function detectLanguage(message: string): ChatbotLanguage {
  if (CEBUANO_MARKERS.test(message)) return 'ceb';
  if (FILIPINO_MARKERS.test(message)) return 'fil';
  return 'en';
}

export function classifyIntent(message: string): ChatbotIntent {
  for (const rule of HANDOFF_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(message))) return rule.intent;
  }
  for (const rule of SAFE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(message))) return rule.intent;
  }
  return 'general';
}

export function requiresHumanHandoff(intent: ChatbotIntent, message: string): string | null {
  const reasons: Partial<Record<ChatbotIntent, string>> = {
    prompt_injection: 'attempted_prompt_injection',
    human_request: 'customer_requested_human',
    order_account: 'order_or_account_specific',
    payment: 'payment_confirmation_required',
    refund_cancellation: 'refund_cancellation_or_order_change',
    complaint: 'customer_complaint',
    allergy_dietary: 'allergy_or_dietary_guarantee',
    custom_feasibility: 'manual_feasibility_or_quote',
  };
  if (reasons[intent]) return reasons[intent] ?? null;

  if (intent === 'availability' && /\b(?:today|tomorrow|specific date|exact date|slot|rush|same[- ]?day|available on)\b/i.test(message)) {
    return 'exact_availability_requires_staff';
  }
  if (intent === 'delivery' && /\b(?:deliver|delivery|hatod)\s+(?:to|sa)\s+/i.test(message)) {
    const mappedCity = /\b(?:cebu(?: city)?|mandaue(?: city)?|lapu[- ]lapu(?: city)?|talisay(?: city)?|consolacion|cordova|liloan)\b/i.test(message);
    if (!mappedCity) return 'unmapped_delivery_area';
  }
  return null;
}

export function sensitiveDataHandoffReason(message: string): string | null {
  if (PAYMENT_CARD_PATTERN.test(message)) return 'payment_card_data';
  if (PRIVATE_REFERENCE_PATTERN.test(message)) return 'private_account_or_payment_reference';
  if (PRIVATE_ADDRESS_PATTERN.test(message)) return 'private_delivery_address';
  if (EMAIL_PATTERN.test(message) || PHONE_PATTERN.test(message)) return 'personal_contact_information';
  return null;
}

export function buildHandoffResult(
  intent: ChatbotIntent,
  language: ChatbotLanguage,
  reason: string,
): ChatbotAssistantResult {
  const answerByLanguage: Record<ChatbotLanguage, string> = {
    en: 'I’ll hand this over to our team so they can check it properly. You can continue here, and a staff member will reply.',
    fil: 'Ipapasa ko ito sa aming team para ma-check nila nang maayos. Magpatuloy lang dito at sasagot ang staff namin.',
    ceb: 'I-forward nako ni sa among team aron ma-check nila tarong. Padayon lang diri ug motubag among staff.',
  };
  return {
    outcome: intent === 'prompt_injection' ? 'refuse' : 'handoff',
    intent,
    language,
    answer: answerByLanguage[language],
    sourceIds: [],
    confidence: 1,
    safetyFlags: [reason],
    handoffReason: reason,
  };
}

const FORBIDDEN_OPERATIONAL_CLAIMS = [
  /\b(?:your|the) order (?:is|has been) (?:confirmed|paid|reserved|cancelled|canceled|refunded)\b/i,
  /\bpayment (?:is|has been) (?:confirmed|received|verified)\b/i,
  /\b(?:we|i) (?:confirmed|cancelled|canceled|refunded|reserved)\b/i,
];

export function validateAssistantResult(
  result: ChatbotAssistantResult,
  allowedSourceIds: ReadonlySet<string>,
): ChatbotAssistantResult | null {
  const answer = result.answer.trim().slice(0, CHATBOT_OUTPUT_MAX_LENGTH);
  if (!answer || FORBIDDEN_OPERATIONAL_CLAIMS.some((pattern) => pattern.test(answer))) return null;
  if (!result.sourceIds.every((id) => allowedSourceIds.has(id))) return null;
  if (!Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1) return null;
  if (result.outcome === 'answer' && result.sourceIds.length === 0) return null;
  return { ...result, answer };
}

export function redactChatHistoryText(value: unknown): string {
  const text = typeof value === 'string' ? value : '';
  return text
    .replace(/https?:\/\/\S+/gi, '[link]')
    .replace(new RegExp(EMAIL_PATTERN.source, 'gi'), '[email]')
    .replace(new RegExp(PHONE_PATTERN.source, 'gi'), '[phone]')
    .replace(new RegExp(PAYMENT_CARD_PATTERN.source, 'g'), '[payment-number]')
    .replace(/\b(?:order|transaction|reference|ref)\s*(?:no\.?|number|id|#)?\s*[:#-]?\s*[A-Z0-9-]{5,}\b/gi, '[reference]')
    .replace(/\b(?:my|our|akong|among)\s+address\s+(?:is|:)?\s+[^.!?\n]+/gi, '[address]')
    .slice(0, CHATBOT_INPUT_MAX_LENGTH);
}
