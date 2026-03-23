import { BasePriceInfo } from '@/types';
import { hexToColorNameProse } from '@/utils/colorUtils';

/**
 * Generates a unique prose paragraph describing the cake design from its analysis data.
 * This creates substantive, unique content per page to avoid thin-content penalties.
 * Shared between the SSR slug page and the client-side CustomizingClient post-analysis view.
 */
export function generateDesignDetails(design: any, prices?: BasePriceInfo[]): string {
    const analysis = design.analysis_json || {};
    const keywords = design.keywords || 'custom';
    const cakeType = analysis.cakeType || 'Custom';
    const icingDesign = analysis.icing_design || {};
    const mainToppers = analysis.main_toppers || [];
    const supportElements = analysis.support_elements || [];
    const cakeMessages = analysis.cake_messages || [];
    const availability = design.availability || 'normal';
    const tags = design.tags || [];

    const sentences: string[] = [];

    // Sentence 1: Introduce the cake with its type and icing base
    const icingBase = icingDesign.base?.replace(/[-_]/g, ' ') || 'soft icing';
    const topColor = hexToColorNameProse(icingDesign.colors?.top || '');
    const sideColor = hexToColorNameProse(icingDesign.colors?.side || '');
    const colorDesc = topColor && sideColor && topColor !== sideColor
        ? `with a ${topColor} top and ${sideColor} sides`
        : topColor ? `in ${topColor}` : 'with a custom color palette';

    if (tags.length >= 2) {
        sentences.push(`Designed specifically for ${tags[0]} or ${tags[1]} events, this ${keywords} cake is a stunning ${cakeType.toLowerCase()} piece finished with ${icingBase} ${colorDesc}.`);
    } else if (tags.length === 1) {
        sentences.push(`A popular choice for ${tags[0]} celebrations, this ${cakeType.toLowerCase()} ${keywords} cake features ${icingBase} ${colorDesc}.`);
    } else {
        sentences.push(`This ${keywords} cake is a ${cakeType.toLowerCase()} design with ${icingBase} featuring ${colorDesc}.`);
    }

    // Sentence 2: Describe the main toppers (the hero elements)
    if (mainToppers.length > 0) {
        const topperDescs = mainToppers
            .slice(0, 4)
            .map((t: any) => t.description || t.type?.replace(/_/g, ' '))
            .filter(Boolean);
        if (topperDescs.length === 1) {
            sentences.push(`The design is highlighted by ${topperDescs[0]}.`);
        } else if (topperDescs.length > 1) {
            const last = topperDescs.pop();
            sentences.push(`The design features ${topperDescs.join(', ')}, and ${last}.`);
        }
    }

    // Sentence 3: Describe support elements if present
    if (supportElements.length > 0) {
        const supportDescs = supportElements
            .slice(0, 3)
            .map((s: any) => {
                const desc = s.description || s.type?.replace(/_/g, ' ');
                return s.quantity > 1 ? `${s.quantity} ${desc}` : desc;
            })
            .filter(Boolean);
        if (supportDescs.length > 0) {
            const last = supportDescs.length > 1 ? supportDescs.pop() : null;
            const joined = last ? `${supportDescs.join(', ')}, and ${last}` : supportDescs[0];
            sentences.push(`Decorative accents include ${joined}.`);
        }
    }

    // Sentence 4: Drip or special icing features
    const specialFeatures: string[] = [];
    if (icingDesign.drip) specialFeatures.push('a drip effect');
    if (icingDesign.border_top) specialFeatures.push('a decorative top border');
    if (icingDesign.border_base) specialFeatures.push('a base border');
    if (icingDesign.gumpasteBaseBoard) specialFeatures.push('a gumpaste baseboard');
    if (specialFeatures.length > 0) {
        const last = specialFeatures.length > 1 ? specialFeatures.pop() : null;
        const joined = last ? `${specialFeatures.join(', ')}, and ${last}` : specialFeatures[0];
        sentences.push(`The icing work includes ${joined} for added detail.`);
    }

    // Sentence 5: Cake messages
    if (cakeMessages.length > 0) {
        const messages = cakeMessages.map((m: any) => `"${m.text}"`).join(' and ');
        sentences.push(`The cake carries the message ${messages}.`);
    }

    // Sentence 6: Pricing and sizes
    if (prices && prices.length > 0) {
        const sorted = [...prices].sort((a, b) => a.price - b.price);
        const lowest = sorted[0];
        const highest = sorted[sorted.length - 1];
        const sizeList = prices.map(p => p.size).join(', ');
        sentences.push(`Available in ${sizeList}, this design starts at ₱${Math.round(lowest.price).toLocaleString()} and goes up to ₱${Math.round(highest.price).toLocaleString()} for the largest size.`);
    }

    // Sentence 7: Availability
    const availabilityMap: Record<string, string> = {
        'rush': 'This is a simple design eligible for rush orders — you can have it ready in as little as 30 minutes to 1 hour.',
        'same-day': 'This design qualifies for same-day orders with approximately 3 to 4 hours of lead time.',
        'normal': 'Due to the complexity of this design, we recommend ordering at least 1 day in advance for the best results.',
    };
    if (availabilityMap[availability]) {
        sentences.push(availabilityMap[availability]);
    }

    return sentences.join(' ');
}

/**
 * Generates dynamic FAQ items specific to this cake design.
 * Each page gets unique Q&A content instead of identical boilerplate.
 * Shared between the SSR slug page and the client-side CustomizingClient post-analysis view.
 */
export function generateDynamicFAQ(design: any, prices?: BasePriceInfo[]): { question: string; answer: string }[] {
    const keywords = design.keywords || 'custom';
    const analysis = design.analysis_json || {};
    const cakeType = analysis.cakeType || 'Custom';
    const availability = design.availability || 'normal';
    const mainToppers = analysis.main_toppers || [];
    const supportElements = analysis.support_elements || [];

    const faqs: { question: string; answer: string }[] = [];

    // FAQ 1: Price — always unique per design
    if (prices && prices.length > 0) {
        const sorted = [...prices].sort((a, b) => a.price - b.price);
        const priceLines = sorted.map(p => `${p.size} at ₱${Math.round(p.price).toLocaleString()}`).join(', ');
        faqs.push({
            question: `How much does this ${keywords} cake cost?`,
            answer: `This ${keywords} ${cakeType.toLowerCase()} cake is available in multiple sizes: ${priceLines}. The price includes the base icing, all decorations shown in the design, and free delivery within Metro Cebu. You can also customize individual elements which may adjust the final price.`,
        });
    }

    // FAQ 2: Availability — varies by design complexity
    const availabilityAnswers: Record<string, string> = {
        'rush': `This ${keywords} cake design is simple enough for a rush order. You can have it ready in as little as 30 minutes to 1 hour, making it perfect for last-minute celebrations. Rush orders are available for pickup or delivery within Metro Cebu.`,
        'same-day': `This ${keywords} cake can be prepared as a same-day order with approximately 3 to 4 hours of lead time. The design includes elements that require some preparation time, but you can still order and receive it on the same day. Place your order before noon for the best availability.`,
        'normal': `This ${keywords} cake design requires at least 1 day of lead time due to its complexity. We recommend ordering at least 1 to 2 days in advance to ensure our bakers can craft every detail perfectly. Order by 3 PM for next-day delivery slots.`,
    };
    faqs.push({
        question: `How soon can I get this ${keywords} cake?`,
        answer: availabilityAnswers[availability] || availabilityAnswers['normal'],
    });

    // FAQ 3: Customization — varies based on what's actually on the cake
    const customizableElements: string[] = [];
    if (mainToppers.length > 0) {
        const topperTypes = [...new Set(mainToppers.map((t: any) => t.type?.replace(/_/g, ' ')))];
        customizableElements.push(`toppers (currently ${topperTypes.join(', ')})`);
    }
    if (analysis.icing_design) {
        customizableElements.push('icing colors and style');
    }
    if (analysis.cake_messages?.length > 0) {
        customizableElements.push('cake messages and text');
    }
    if (supportElements.length > 0) {
        customizableElements.push('decorative accents');
    }

    if (customizableElements.length > 0) {
        const lastEl = customizableElements.length > 1 ? customizableElements.pop() : null;
        const joined = lastEl ? `${customizableElements.join(', ')}, and ${lastEl}` : customizableElements[0];
        faqs.push({
            question: `Can I customize this ${keywords} cake design?`,
            answer: `Yes, you can fully customize this design. Editable elements include ${joined}. Use our AI-powered customizer to swap, add, or remove individual elements and see how each change affects the price in real time. For example, switching a toy topper to a printed one can adjust the cost.`,
        });
    }

    // FAQ 4: Delivery — semi-dynamic with cake type context
    faqs.push({
        question: `Do you deliver this ${cakeType.toLowerCase()} cake in Cebu?`,
        answer: `Yes, we offer free delivery for this ${keywords} ${cakeType.toLowerCase()} cake throughout Metro Cebu, including Cebu City, Mandaue, Mactan, Lapu-Lapu, and Talisay. We also serve select areas in Cavite. All cakes are delivered fresh by our partner bakers to ensure quality.`,
    });

    // FAQ 5: Payment methods — static but important for conversions and trust
    faqs.push({
        question: 'What payment options are available?',
        answer: 'We accept e-wallets (GCash and Maya), bank transfers (BDO, BPI, and Metrobank), and all major credit and debit cards processed securely via Xendit. You can choose your preferred payment method at checkout.',
    });

    return faqs;
}

/**
 * Generates descriptive rich alt text from the design analysis.
 * Prioritizes the AI-generated alt_text from the database if available.
 * Auto-generated backup pattern mirrors cakesandmemories.com style:
 *   "{keywords} {occasion} cake design — {tier} {icingBase} cake in {colors} with {toppers list}"
 */
export function generateRichAltText(design: any): string {
    // 1. Prioritize existing AI-generated alt text from the database (most natural)
    if (design.alt_text && design.alt_text.length > 15) {
        return design.alt_text;
    }

    // 2. Auto-generated backup: build rich, specific alt text from analysis data.
    //    Many of the 8K+ designs hit this path when alt_text is empty.
    const analysis = design.analysis_json || {};
    const keywords = design.keywords || 'Custom';
    const tags = design.tags || [];
    const occasion = tags[0] ? tags[0].replace(/cake/i, '').trim() : '';

    // Human-readable tier names (e.g., "single-tier" instead of "1 tier")
    const tierMap: Record<string, string> = {
        '1 tier': 'single-tier', '2 tier': 'two-tier', '3 tier': 'three-tier',
        '1 tier fondant': 'single-tier fondant', '2 tier fondant': 'two-tier fondant', '3 tier fondant': 'three-tier fondant',
        'bento': 'bento', 'square': 'square', 'rectangle': 'rectangle',
        'square fondant': 'square fondant', 'rectangle fondant': 'rectangle fondant',
    };
    const rawCakeType = (analysis.cakeType || '').toLowerCase();
    const cakeType = tierMap[rawCakeType] || rawCakeType;
    const icingBase = (analysis.icing_design?.base || 'icing').replace(/[-_]/g, ' ');

    const topColor = hexToColorNameProse(analysis.icing_design?.colors?.top || '');
    const sideColor = hexToColorNameProse(analysis.icing_design?.colors?.side || '');
    const colors = topColor && sideColor && topColor !== sideColor ? `${topColor} and ${sideColor}` : topColor;

    // Build decoration list (expanded to 4 items for richer descriptions)
    const mainTopperDescs = (analysis.main_toppers || [])
        .map((d: any) => d.description || d.type?.replace(/_/g, ' ')).filter(Boolean);
    const supportDescs = (analysis.support_elements || [])
        .map((d: any) => d.description || d.type?.replace(/_/g, ' ')).filter(Boolean);
    const allDecos = [...mainTopperDescs, ...supportDescs].slice(0, 4);

    // Build message mention (e.g., 'custom "Happy Birthday" message')
    const messages = (analysis.cake_messages || [])
        .map((m: any) => m.text).filter(Boolean);
    const messagePart = messages.length > 0
        ? `custom "${messages[0]}" message`
        : '';

    // Assemble: "{Keywords} {occasion} cake design — {tier} {icing} cake in {colors} with {decos}"
    const parts: string[] = [];

    // Opening: always include "cake design" for search matching
    const prefix = `${keywords}${occasion ? ` ${occasion}` : ''} cake design`.replace(/\s+/g, ' ').trim();
    parts.push(prefix);

    // Cake description
    const cakeDesc = `${cakeType} ${icingBase} cake${colors ? ` in ${colors}` : ''}`.trim();
    if (cakeType || colors) parts.push(cakeDesc);

    // Decorations
    if (allDecos.length > 0 || messagePart) {
        const decoItems = [...allDecos];
        if (messagePart) decoItems.push(messagePart);
        if (decoItems.length === 1) {
            parts.push(`with ${decoItems[0]}`);
        } else {
            const last = decoItems.pop();
            parts.push(`with ${decoItems.join(', ')}, and ${last}`);
        }
    }

    const generated = parts.join(' — ').replace(/\s+/g, ' ').trim();
    const capitalized = generated.charAt(0).toUpperCase() + generated.slice(1);

    if (allDecos.length > 0 || colors || messagePart) return capitalized;

    // 3. Absolute fallback
    return `${keywords} cake design`;
}

