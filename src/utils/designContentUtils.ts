import { BasePriceInfo } from '@/types';
import { hexToColorNameProse } from '@/utils/colorUtils';

export type DesignFaq = { question: string; answer: string };

export type DesignPageContent = {
    description: string;
    faqs: DesignFaq[];
    estimatedUniqueWordCount: number;
};
export type DesignPageContentMetrics = {
    uniqueText: string;
    totalWordCount: number;
    uniqueWordCount: number;
    boilerplateWordCount: number;
};

export const THIN_PAGE_MIN_UNIQUE_WORDS = 250;

const STATIC_BOILERPLATE_PHRASES = [
    'simply select your desired size and height options from the configuration menu above',
    'the price will update in real time and be displayed in the add to cart bar at the bottom of the screen',
    'we recommend ordering at least 1 to 2 days in advance to ensure our bakers can craft every detail perfectly',
    'order by 3 pm for next-day delivery slots',
    'yes, we offer free delivery for this',
    'throughout metro cebu, including cebu city, mandaue, mactan, lapu-lapu, and talisay',
    'we also serve select areas in cavite',
    'all cakes are delivered fresh by our partner bakers to ensure quality',
    'yes, you can fully customize this design',
    'use our ai-powered customizer to swap, add, or remove individual elements and see how each change affects the price in real time',
    'we accept e-wallets (gcash and maya), bank transfers (bdo, bpi, and metrobank), and all major credit and debit cards processed securely via xendit',
    'you can choose your preferred payment method at checkout',
    'free delivery is available throughout metro cebu, including cebu city, mandaue, lapu-lapu, and talisay',
    'ordering & policy details',
    'delivery coverage and fees',
    'review the return and cancellation policy',
    'browse genie.ph customer reviews',
] as const;

function isCupcakeDesign(design: any): boolean {
    const cakeType = (design.analysis_json?.cakeType || '').toLowerCase();
    return cakeType === 'cupcake'
        || cakeType.startsWith('cupcakes-')
        || (design.slug || '').includes('cupcakes-');
}

function joinReadableList(items: string[]): string {
    const cleaned = [...new Set(items.map((item) => item.trim()).filter(Boolean))];
    if (cleaned.length === 0) return '';
    if (cleaned.length === 1) return cleaned[0];
    if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;

    const last = cleaned[cleaned.length - 1];
    return `${cleaned.slice(0, -1).join(', ')}, and ${last}`;
}

function collectFeatureDescriptions(items: any[], limit: number): string[] {
    return [...new Set(
        items
            .map((item) => item.description || item.type?.replace(/_/g, ' '))
            .filter(Boolean),
    )].slice(0, limit);
}

function buildDesignSpecsText(design: any): string {
    return `
        Cake Style: ${design.analysis_json?.cakeType || ''} ${design.keywords || ''}
        Icing Finish: ${design.analysis_json?.icing_design?.base || ''}
        Features: ${(design.analysis_json?.main_toppers || []).map((t: any) => t.description || t.type).join(', ')}
        Decorations: ${(design.analysis_json?.support_elements || []).map((s: any) => s.description || s.type).join(', ')}
        Tags: ${(design.tags || []).join(', ')}
    `;
}

function stripStaticBoilerplate(text: string): string {
    let cleanedText = text.toLowerCase();

    for (const phrase of STATIC_BOILERPLATE_PHRASES) {
        cleanedText = cleanedText.replace(phrase, '');
    }

    return cleanedText.replace(/\s+/g, ' ').trim();
}

function countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
}

function buildThinPageBoostFaqs(design: any): DesignFaq[] {
    const analysis = design.analysis_json || {};
    const keywords = design.keywords || 'custom';
    const cakeType = analysis.cakeType || 'Custom';
    const icingDesign = analysis.icing_design || {};
    const mainToppers = analysis.main_toppers || [];
    const supportElements = analysis.support_elements || [];
    const cakeMessages = analysis.cake_messages || [];
    const isCupcake = isCupcakeDesign(design);
    const subject = isCupcake ? `these ${keywords} cupcakes` : `this ${keywords} cake`;
    const cakeForm = `${cakeType || 'custom'} ${isCupcake ? 'cupcakes' : 'cake'}`.trim().toLowerCase();
    const icingBase = (icingDesign.base || 'soft icing').replace(/[-_]/g, ' ');
    const topColor = hexToColorNameProse(icingDesign.colors?.top || '');
    const sideColor = hexToColorNameProse(icingDesign.colors?.side || '');
    const colorPhrase = topColor && sideColor && topColor !== sideColor
        ? `${topColor} top and ${sideColor} sides`
        : topColor || sideColor || 'current color palette';
    const signatureElements = [
        ...collectFeatureDescriptions(mainToppers, 2),
        ...collectFeatureDescriptions(supportElements, 3),
    ].slice(0, 4);
    const visibleMessage = cakeMessages[0]?.text
        ? `the current piped message (${cakeMessages[0].text})`
        : 'a short piped message or age detail';
    const hasFondant = cakeType.toLowerCase().includes('fondant') || icingBase.includes('fondant');
    const hasNonEdibleDecor = [...mainToppers, ...supportElements].some((item) => {
        const haystack = `${item.material || ''} ${item.type || ''} ${item.description || ''}`.toLowerCase();
        return haystack.includes('non-edible')
            || haystack.includes('ribbon')
            || haystack.includes('toy')
            || haystack.includes('figure')
            || haystack.includes('plastic')
            || haystack.includes('cardstock');
    });
    const pipedAccentCount = supportElements.reduce((total: number, item: any) => {
        const haystack = `${item.type || ''} ${item.description || ''}`.toLowerCase();
        if (haystack.includes('piped') || haystack.includes('icing')) {
            return total + Math.max(1, item.quantity || 1);
        }
        return total;
    }, 0);

    const lookAnchors = [
        `${icingBase} finish`,
        colorPhrase,
        ...(signatureElements.length > 0 ? [joinReadableList(signatureElements.slice(0, 2))] : []),
    ].filter(Boolean);

    const editableElements = [
        visibleMessage,
        topColor || sideColor ? 'the accent colors' : '',
        mainToppers.length > 0 ? 'the topper mix' : '',
        supportElements.length > 0 ? 'the number and placement of the accents' : '',
    ].filter(Boolean);

    const priceDrivers = [
        hasFondant ? 'the fondant finish' : '',
        mainToppers.length > 0 ? joinReadableList(collectFeatureDescriptions(mainToppers, 2)) : '',
        pipedAccentCount >= 4 ? 'the amount of hand-piped detailing' : '',
        hasNonEdibleDecor ? 'the non-edible decorative materials' : '',
        !hasFondant && mainToppers.length === 0 && pipedAccentCount < 4 ? `${icingBase} base work and final finishing` : '',
    ].filter(Boolean);

    const lowerCostMoves = [
        hasFondant ? 'switching the finish from fondant to soft icing' : '',
        mainToppers.length > 0 ? 'simplifying the topper set' : '',
        supportElements.length > 1 ? 'reducing the number of accent pieces' : '',
        !hasFondant && mainToppers.length === 0 ? 'keeping the same palette while simplifying the hand-worked accents' : '',
    ].filter(Boolean);

    const decoratedAreas = signatureElements.length > 0
        ? joinReadableList(signatureElements.slice(0, 2))
        : 'decorative details';

    return [
        {
            question: isCupcake
                ? `How can I change these ${keywords} cupcakes without losing the overall look?`
                : `How can I change this ${keywords} cake without losing the overall look?`,
            answer: `To keep the same overall feel, preserve the ${joinReadableList(lookAnchors)}. You can still change ${joinReadableList(editableElements)} without losing the identity of ${subject}. That approach works well when you want the same concept adapted for another age, message, or event setup.`,
        },
        {
            question: isCupcake
                ? `How should I store and transport these ${keywords} cupcakes?`
                : `How should I store and transport this ${keywords} cake?`,
            answer: hasFondant
                ? `Because ${subject} uses fondant, keep it in a cool air-conditioned room and away from direct sunlight until serving. Carry the box on a flat surface and avoid condensation on ${decoratedAreas}, especially during longer travel. Keeping the box level helps the shaped details stay crisp from pickup to setup.`
                : `Because ${subject} uses a ${icingBase} finish, keep it chilled until shortly before serving and transport it on a flat surface in an air-conditioned vehicle. The ${decoratedAreas} will hold their shape better if the box stays level and out of direct heat. This is especially important for a ${cakeForm} where the finishing details are part of the main look.`,
        },
        {
            question: isCupcake
                ? `What parts of these ${keywords} cupcakes affect the price the most?`
                : `What parts of this ${keywords} cake affect the price the most?`,
            answer: `For ${subject}, the main price drivers are ${joinReadableList(priceDrivers)}. If you want a lower quote without changing the concept, start by ${joinReadableList(lowerCostMoves)}. Keeping the base colors and overall theme consistent usually preserves the look even when the most labor-heavy details are simplified.`,
        },
    ];
}

export function isGenericDesignDescription(description: string | null | undefined): boolean {
    if (!description) return true;
    const normalized = description.toLowerCase().trim();

    return (
        (normalized.includes('get instant pricing for this') && normalized.includes('genie.ph'))
        || normalized.includes('get the price of any cake instantly')
        || normalized.includes('customize and order at genie.ph')
    );
}

export function getDesignPageContentMetrics(
    design: any,
    description: string,
    faqs: DesignFaq[],
): DesignPageContentMetrics {
    const faqText = faqs.map((faq) => `${faq.question} ${faq.answer}`).join(' ');
    const specsText = buildDesignSpecsText(design);
    const fullText = `${description} ${faqText} ${specsText}`.replace(/\s+/g, ' ').trim();
    const cleanedText = stripStaticBoilerplate(fullText);
    const totalWordCount = countWords(fullText);
    const uniqueWordCount = countWords(cleanedText);

    return {
        uniqueText: cleanedText,
        totalWordCount,
        uniqueWordCount,
        boilerplateWordCount: Math.max(0, totalWordCount - uniqueWordCount),
    };
}

export function buildDesignPageContent(design: any, prices?: BasePriceInfo[]): DesignPageContent {
    const generatedDescription = generateDesignDetails(design, prices);
    const seededDescription = !isGenericDesignDescription(design.seo_description)
        ? design.seo_description.trim()
        : generatedDescription;
    const faqs = [...generateDynamicFAQ(design, prices)];

    let description = seededDescription;
    let metrics = getDesignPageContentMetrics(design, description, faqs);

    for (const faq of buildThinPageBoostFaqs(design)) {
        if (metrics.uniqueWordCount >= THIN_PAGE_MIN_UNIQUE_WORDS) break;
        if (faqs.some((existingFaq) => existingFaq.question === faq.question)) continue;

        faqs.push(faq);
        metrics = getDesignPageContentMetrics(design, description, faqs);
    }

    if (metrics.uniqueWordCount < THIN_PAGE_MIN_UNIQUE_WORDS && description !== generatedDescription) {
        const combinedDescription = `${description} ${generatedDescription}`.replace(/\s+/g, ' ').trim();
        const combinedMetrics = getDesignPageContentMetrics(design, combinedDescription, faqs);

        if (combinedMetrics.uniqueWordCount > metrics.uniqueWordCount) {
            description = combinedDescription;
            metrics = combinedMetrics;
        }
    }

    return {
        description,
        faqs,
        estimatedUniqueWordCount: metrics.uniqueWordCount,
    };
}

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

    const isCupcake = cakeType.toLowerCase() === 'cupcake' || cakeType.toLowerCase().startsWith('cupcakes-') || (design.slug || '').includes('cupcakes-');
    const pNoun = isCupcake ? 'cupcakes' : 'cake';

    // Map tier to layer synonym so page text naturally contains both terms
    // ("1 tier" and "1 layer") — Filipino users search both interchangeably
    const layerSynonymMap: Record<string, string> = {
        '1 tier': '1 layer (single tier)', '2 tier': '2 layer (two tier)', '3 tier': '3 layer (three tier)',
        '1 tier fondant': '1 layer fondant', '2 tier fondant': '2 layer fondant', '3 tier fondant': '3 layer fondant',
    };
    const cakeTypeDisplay = cakeType.toLowerCase();
    const cakeTypeWithSynonym = layerSynonymMap[cakeTypeDisplay] || cakeTypeDisplay;

    const sentences: string[] = [];

    // Sentence 1: Introduce the cake with its type and icing base
    const icingBase = icingDesign.base?.replace(/[-_]/g, ' ') || 'soft icing';
    const topColor = hexToColorNameProse(icingDesign.colors?.top || '');
    const sideColor = hexToColorNameProse(icingDesign.colors?.side || '');
    const colorDesc = topColor && sideColor && topColor !== sideColor
        ? `with a ${topColor} top and ${sideColor} sides`
        : topColor ? `in ${topColor}` : 'with a custom color palette';

    if (tags.length >= 2) {
        if (isCupcake) {
            sentences.push(`Designed specifically for ${tags[0]} or ${tags[1]} events, these ${keywords} cupcakes are a stunning set finished with ${icingBase} ${colorDesc}.`);
        } else {
            sentences.push(`Designed specifically for ${tags[0]} or ${tags[1]} events, this ${keywords} cake is a stunning ${cakeTypeWithSynonym} piece finished with ${icingBase} ${colorDesc}.`);
        }
    } else if (tags.length === 1) {
        if (isCupcake) {
            sentences.push(`A popular choice for ${tags[0]} celebrations, these ${keywords} cupcakes feature ${icingBase} ${colorDesc}.`);
        } else {
            sentences.push(`A popular choice for ${tags[0]} celebrations, this ${cakeTypeWithSynonym} ${keywords} cake features ${icingBase} ${colorDesc}.`);
        }
    } else {
        if (isCupcake) {
            sentences.push(`These ${keywords} cupcakes are a custom design with ${icingBase} featuring ${colorDesc}.`);
        } else {
            sentences.push(`This ${keywords} cake is a ${cakeTypeWithSynonym} design with ${icingBase} featuring ${colorDesc}.`);
        }
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

    // Sentence 5: Cake/cupcake messages
    if (cakeMessages.length > 0) {
        const messages = cakeMessages.map((m: any) => `"${m.text}"`).join(' and ');
        sentences.push(`The ${pNoun} carry the message ${messages}.`);
    }

    // Sentence 6: Pricing and sizes
    if (prices && prices.length > 0) {
        const sorted = [...prices].sort((a, b) => a.price - b.price);
        const lowest = sorted[0];
        const highest = sorted[sorted.length - 1];
        const sizeList = prices.map(p => p.size).join(', ');
        const availabilityHint = availability === 'rush'
            ? ' Rush orders are available for this design.'
            : availability === 'same-day'
                ? ' Same-day delivery is available.'
                : ' Order by 3 PM for next-day delivery.';
        if (isCupcake) {
            sentences.push(`Available in ${sizeList}, this design is priced at ₱${Math.round(lowest.price).toLocaleString()} for a set.${availabilityHint}`);
        } else {
            sentences.push(`Available in ${sizeList}, this design starts at ₱${Math.round(lowest.price).toLocaleString()} and goes up to ₱${Math.round(highest.price).toLocaleString()} for the largest size.${availabilityHint}`);
        }
    }

    // Sentence 7: Delivery coverage
    sentences.push(`Free delivery is available throughout Metro Cebu, including Cebu City, Mandaue, Lapu-Lapu, and Talisay.`);

    // Sentence 8: Budget Customization Tips based on topper/icing types
    const allItems = [...mainToppers, ...supportElements];
    const itemStrings = allItems.map(item => `${item.type || ''} ${item.description || ''}`.toLowerCase());

    const hasFondant = cakeType.toLowerCase().includes('fondant') || (icingDesign.base || '').toLowerCase().includes('fondant');
    const hasEdibleTopper = itemStrings.some(s => s.includes('edible') && !s.includes('photo') && !s.includes('image') && !s.includes('print'));
    const hasToy = itemStrings.some(s => s.includes('toy') || s.includes('figure') || s.includes('doll') || s.includes('plastic'));
    const hasEdiblePhoto = itemStrings.some(s => s.includes('photo') || s.includes('image') || s.includes('print')) && itemStrings.some(s => s.includes('edible'));
    const hasGlitterCardstock = itemStrings.some(s => s.includes('cardstock') || s.includes('glitter') || s.includes('paper'));

    const budgetTips: string[] = [];
    if (hasFondant) budgetTips.push('swapping the fondant finish for a soft icing base');
    if (hasEdibleTopper) budgetTips.push('replacing the edible toppers with a plastic toy or a free paper printout');
    if (hasToy) budgetTips.push('replacing the toy toppers with a free paper printout');
    if (hasEdiblePhoto) budgetTips.push('replacing the edible photo elements with a free paper printout');
    if (hasGlitterCardstock) budgetTips.push('replacing the glitter cardstock toppers with a free printout');

    if (budgetTips.length > 0) {
        let joinedTips = '';
        if (budgetTips.length === 1) {
            joinedTips = budgetTips[0];
        } else {
            const lastTip = budgetTips.pop();
            joinedTips = `${budgetTips.join(', ')}, or ${lastTip}`;
        }
        sentences.push(`If you are looking to customize this design on a budget, you can save money by ${joinedTips}.`);
    }

    // Sentence 9: Care Instructions based on Icing Finish
    if (hasFondant) {
        sentences.push(`To preserve the hand-crafted fondant details, keep the cake in a cool, air-conditioned room and avoid direct sunlight. Avoid refrigerating fondant elements before serving to prevent condensation.`);
    } else {
        sentences.push(`Because this design features a delicate soft icing finish, we recommend keeping the cake refrigerated until 30 minutes before serving. Transport flat in an air-conditioned vehicle.`);
    }

    return sentences.join(' ');
}

/**
 * Generates dynamic FAQ items specific to this cake design.
 * Each page gets unique Q&A content instead of identical boilerplate.
 * Shared between the SSR slug page and the client-side CustomizingClient post-analysis view.
 */
export function generateDynamicFAQ(design: any, prices?: BasePriceInfo[]): DesignFaq[] {
    const keywords = design.keywords || 'custom';
    const analysis = design.analysis_json || {};
    const cakeType = analysis.cakeType || 'Custom';
    const availability = design.availability || 'normal';
    const mainToppers = analysis.main_toppers || [];
    const supportElements = analysis.support_elements || [];

    const isCupcake = cakeType.toLowerCase() === 'cupcake' || cakeType.toLowerCase().startsWith('cupcakes-') || (design.slug || '').includes('cupcakes-');
    const pPluralThis = isCupcake ? 'these' : 'this';

    const faqs: { question: string; answer: string }[] = [];

    // FAQ 1: Price — always unique per design
    if (prices && prices.length > 0) {
        faqs.push({
            question: isCupcake ? `How much do these ${keywords} cupcakes cost?` : `How much does this ${keywords} cake cost?`,
            answer: isCupcake
                ? `To see the exact price for these ${keywords} cupcakes, simply select your desired options (such as flavor or quantity) from the configuration menu above. The price will update in real time and be displayed in the add to cart bar at the bottom of the screen.`
                : `To see the exact price for this ${keywords} cake, simply select your desired size and height options from the configuration menu above. The price will update in real time and be displayed in the add to cart bar at the bottom of the screen.`,
        });
    }

    // FAQ 2: Availability — varies by design complexity
    const availabilityAnswers: Record<string, string> = {
        'rush': isCupcake
            ? `These ${keywords} cupcakes are simple enough for a rush order. You can have them ready in as little as 60 minutes, making them perfect for last-minute celebrations. Rush orders are available for pickup or delivery within Metro Cebu.`
            : `This ${keywords} cake design is simple enough for a rush order. You can have it ready in as little as 60 minutes, making it perfect for last-minute celebrations. Rush orders are available for pickup or delivery within Metro Cebu.`,
        'same-day': isCupcake
            ? `These ${keywords} cupcakes can be prepared as a same-day order with approximately 3 to 4 hours of lead time. Place your order before noon for the best availability.`
            : `This ${keywords} cake can be prepared as a same-day order with approximately 3 to 4 hours of lead time. The design includes elements that require some preparation time, but you can still order and receive it on the same day. Place your order before noon for the best availability.`,
        'normal': isCupcake
            ? `These ${keywords} cupcakes require at least 1 day of lead time. We recommend ordering at least 1 to 2 days in advance to ensure our bakers can craft every detail perfectly. Order by 3 PM for next-day delivery slots.`
            : `This ${keywords} cake design requires at least 1 day of lead time due to its complexity. We recommend ordering at least 1 to 2 days in advance to ensure our bakers can craft every detail perfectly. Order by 3 PM for next-day delivery slots.`,
    };
    faqs.push({
        question: isCupcake ? `How soon can I get ${pPluralThis} ${keywords} cupcakes?` : `How soon can I get this ${keywords} cake?`,
        answer: availabilityAnswers[availability] || availabilityAnswers['normal'],
    });

    // FAQ 3: Customization — varies based on what's actually on the cake
    const customizableElements: string[] = [];
    if (mainToppers.length > 0) {
        const topperDescriptions = [...new Set(mainToppers.map((t: any) => t.description || t.type?.replace(/_/g, ' ')))];
        customizableElements.push(`toppers (currently ${topperDescriptions.join(', ')})`);
    }
    if (analysis.icing_design) {
        customizableElements.push('icing colors and style');
    }
    if (analysis.cake_messages?.length > 0) {
        customizableElements.push('messages and text');
    }
    if (supportElements.length > 0) {
        customizableElements.push('decorative accents');
    }

    if (customizableElements.length > 0) {
        const lastEl = customizableElements.length > 1 ? customizableElements.pop() : null;
        const joined = lastEl ? `${customizableElements.join(', ')}, and ${lastEl}` : customizableElements[0];
        faqs.push({
            question: isCupcake ? `Can I customize ${pPluralThis} ${keywords} cupcakes?` : `Can I customize this ${keywords} cake design?`,
            answer: `Yes, you can fully customize this design. Editable elements include ${joined}. Use our AI-powered customizer to swap, add, or remove individual elements and see how each change affects the price in real time.`,
        });
    }

    // FAQ 4: Delivery — semi-dynamic with cake type context
    faqs.push({
        question: isCupcake ? `Do you deliver ${pPluralThis} ${keywords} cupcakes in Cebu?` : `Do you deliver this ${keywords} cake in Cebu?`,
        answer: isCupcake
            ? `Yes, we offer free delivery for these ${keywords} cupcakes throughout Metro Cebu, including Cebu City, Mandaue, Mactan, Lapu-Lapu, and Talisay. We also serve select areas in Cavite.`
            : `Yes, we offer free delivery for this ${keywords} cake throughout Metro Cebu, including Cebu City, Mandaue, Mactan, Lapu-Lapu, and Talisay. We also serve select areas in Cavite. All cakes are delivered fresh by our partner bakers to ensure quality.`,
    });

    // FAQ 5: Budget Customization FAQ
    const allItems = [...mainToppers, ...supportElements];
    const itemStrings = allItems.map(item => `${item.type || ''} ${item.description || ''}`.toLowerCase());
    const hasFondant = cakeType.toLowerCase().includes('fondant') || (analysis.icing_design?.base || '').toLowerCase().includes('fondant');
    const hasEdibleTopper = itemStrings.some(s => s.includes('edible') && !s.includes('photo') && !s.includes('image') && !s.includes('print'));
    const hasToy = itemStrings.some(s => s.includes('toy') || s.includes('figure') || s.includes('doll') || s.includes('plastic'));
    const hasEdiblePhoto = itemStrings.some(s => s.includes('photo') || s.includes('image') || s.includes('print')) && itemStrings.some(s => s.includes('edible'));
    const hasGlitterCardstock = itemStrings.some(s => s.includes('cardstock') || s.includes('glitter') || s.includes('paper'));

    const faqBudgetTips: string[] = [];
    if (hasFondant) faqBudgetTips.push('swapping the fondant finish for a soft icing base');
    if (hasEdibleTopper) faqBudgetTips.push('replacing the edible toppers with a plastic toy or a free paper printout');
    if (hasToy) faqBudgetTips.push('replacing the toy toppers with a free paper printout');
    if (hasEdiblePhoto) faqBudgetTips.push('replacing the edible photo elements with a free paper printout');
    if (hasGlitterCardstock) faqBudgetTips.push('replacing the glitter cardstock toppers with a free printout');

    if (faqBudgetTips.length > 0) {
        let joinedTips = '';
        if (faqBudgetTips.length === 1) {
            joinedTips = faqBudgetTips[0];
        } else {
            const lastTip = faqBudgetTips.pop();
            joinedTips = `${faqBudgetTips.join(', ')}, or ${lastTip}`;
        }
        faqs.push({
            question: isCupcake ? `How can I customize these ${keywords} cupcakes on a budget?` : `How can I customize this ${keywords} cake to save money?`,
            answer: `You can customize this design to fit a smaller budget by swapping premium decorations for lower-cost alternatives. For this specific design, you can save by ${joinedTips}. Simply specify these choices in the additional instructions box before checkout.`,
        });
    }

    // FAQ 6: Payment methods — static but important for conversions and trust
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
    const storedAlt = (design.alt_text || '').trim();
    const isCupcake = (design.analysis_json?.cakeType || '').toLowerCase().includes('cupcake') || (design.slug || '').includes('cupcupcake') || (design.slug || '').includes('cupcakes-');

    // 1. Trust substantial stored alt text without regenerating.
    if (storedAlt.length >= 60) {
        if (isCupcake && /cupcake/i.test(storedAlt) && /\s+cake/i.test(storedAlt)) {
            return storedAlt.replace(/\s+cake/ig, '');
        }
        return storedAlt;
    }

    // 2. Auto-generated backup: build rich, specific alt text from analysis data.
    const analysis = design.analysis_json || {};
    const keywords = design.keywords || 'Custom';
    const tags = design.tags || [];
    const occasion = tags[0] ? tags[0].replace(/cake/i, '').replace(/cupcakes?/i, '').trim() : '';
    const keywordsLower = keywords.toLowerCase();
    const occasionLower = occasion.toLowerCase();

    // Search-friendly tier names
    const tierMap: Record<string, string> = {
        '1 tier': '1 layer', '2 tier': '2 tier', '3 tier': '3 tier',
        '1 tier fondant': '1 layer fondant', '2 tier fondant': '2 layer fondant', '3 tier fondant': '3 tier fondant',
        'bento': 'bento', 'square': 'square', 'rectangle': 'rectangle',
        'square fondant': 'square fondant', 'rectangle fondant': 'rectangle fondant',
    };
    const rawCakeType = (analysis.cakeType || '').toLowerCase();
    const cakeType = tierMap[rawCakeType] || rawCakeType;
    const rawIcingBase = (analysis.icing_design?.base || 'icing').replace(/[-_]/g, ' ');
    const icingBase = cakeType.includes(rawIcingBase) ? '' : rawIcingBase;

    const topColor = hexToColorNameProse(analysis.icing_design?.colors?.top || '');
    const sideColor = hexToColorNameProse(analysis.icing_design?.colors?.side || '');
    const colors = topColor && sideColor && topColor !== sideColor ? `${topColor} and ${sideColor}` : topColor;

    // Build decoration list
    const mainTopperDescs = (analysis.main_toppers || [])
        .map((d: any) => d.description || d.type?.replace(/_/g, ' ')).filter(Boolean);
    const supportDescs = (analysis.support_elements || [])
        .map((d: any) => d.description || d.type?.replace(/_/g, ' ')).filter(Boolean);
    const allDecos = [...mainTopperDescs, ...supportDescs].slice(0, 4);

    // Build message mention
    const messages = (analysis.cake_messages || [])
        .map((m: any) => m.text).filter(Boolean);
    const messagePart = messages.length > 0
        ? `custom "${messages[0]}" message`
        : '';

    // Assemble parts
    const parts: string[] = [];

    // Opening
    const shouldAppendOccasion = Boolean(occasion && !keywordsLower.includes(occasionLower));
    const keywordPhrase = `${keywords}${shouldAppendOccasion ? ` ${occasion}` : ''}`.replace(/\s+/g, ' ').trim();
    const suffixPhrase = isCupcake ? 'cupcakes' : 'cake design';
    const prefix = `${keywordPhrase}${/\bcupcakes?\b/i.test(keywordPhrase) ? '' : ` ${suffixPhrase}`}`.replace(/\s+/g, ' ').trim();
    parts.push(prefix);

    // Cake description
    const cakeDesc = isCupcake
        ? `set of ${colors || 'custom colored'} cupcakes`.trim()
        : `${cakeType}${icingBase ? ` ${icingBase}` : ''} cake${colors ? ` in ${colors}` : ''}`.trim();
    if (isCupcake || cakeType || colors) parts.push(cakeDesc);

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

    // 3. Prefer the generated alt when analysis data produced something richer
    const hasRichGeneration = allDecos.length > 0 || colors || messagePart;
    if (hasRichGeneration && capitalized.length > storedAlt.length) {
        return capitalized;
    }
    if (storedAlt.length > 0) {
        return storedAlt;
    }
    if (hasRichGeneration) {
        return capitalized;
    }

    // 4. Absolute fallback
    return `${keywords} cake design`;
}

export interface DynamicCollectionDesign {
    keywords?: string | null;
    analysis_json?: {
        cakeType?: string | null;
        icing_design?: {
            colors?: {
                top?: string | null;
                side?: string | null;
            } | null;
            base?: string | null;
        } | null;
        main_toppers?: {
            description?: string | null;
            type?: string | null;
        }[] | null;
        cake_messages?: {
            text?: string | null;
        }[] | null;
    } | null;
}

export interface AIApiClient {
    models: {
        generateContent(options: {
            model: string;
            contents: { role: string; parts: { text: string }[] }[];
            config?: Record<string, unknown>;
        }): Promise<{ text?: string | null }>;
    };
}

/**
 * Dynamically generates a descriptive collection-level summary using Gemini 3.1 Flash Lite.
 * Analyzes the top designs in the collection to extract common themes, colors, and toppers.
 * Enforces strict GMC compliance (no prices, no URLs, no transaction CTAs).
 */
export const generateDynamicCollectionDescription = async (
    categoryName: string,
    designs: DynamicCollectionDesign[],
    aiClient: AIApiClient
): Promise<string> => {
    try {
        if (!designs || designs.length === 0) {
            return '';
        }

        // Format design details for prompt context
        const designsContext = designs.slice(0, 4).map((d: DynamicCollectionDesign, i: number) => {
            const toppers = (d.analysis_json?.main_toppers || []).map((t) => t.description || t.type).join(', ');
            const colors = d.analysis_json?.icing_design?.colors?.top || '';
            const messages = (d.analysis_json?.cake_messages || []).map((m) => m.text).join(', ');
            const cakeType = d.analysis_json?.cakeType || 'Custom';
            return `Design ${i + 1}:
- Style: ${cakeType}
- Colors: ${colors}
- Toppers: ${toppers}
- Messages: ${messages}
- Keywords: ${d.keywords || ''}`;
        }).join('\n\n');

        const prompt = `You are a professional copywriter and SEO specialist.
Write a highly engaging, human-oriented, and visual collection description for a gallery of "${categoryName}" themed custom cakes.

Based on the designs in this collection:
${designsContext}

Requirements:
1. Write exactly 2 to 3 sentences (50 to 80 words).
2. Focus on describing the common visual themes, color palettes, and popular toppers shown in the designs.
3. Keep the tone creative, celebratory, and welcoming for someone browsing cake designs.
4. Enforce strict GMC/brand compliance:
   - Absolutely NO pricing, currency symbols (₱, PHP), or starts at.
   - Absolutely NO URLs, site names, or brand name (do not mention Genie.ph, Genie, or other sites).
   - Absolutely NO transactional calls to action (do not say "order now", "buy today", "get pricing", "customize").
   - Absolutely NO promotional claims (no "free delivery", "best", "cheap", "delicious").

Return JSON in this format:
{
  "description": "string"
}
`;

        const response = await aiClient.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        description: { type: 'STRING' }
                    },
                    required: ['description']
                },
                temperature: 0.7,
                thinkingConfig: {
                    thinkingLevel: 'LOW'
                }
            }
        });

        const text = (response.text || '').trim();
        const parsed = JSON.parse(text);
        return (parsed.description || '').trim();
    } catch (error) {
        console.error('Failed to generate dynamic collection description:', error);
        return '';
    }
};
