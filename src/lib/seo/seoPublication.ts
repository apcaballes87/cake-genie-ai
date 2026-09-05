import type { HybridAnalysisResult } from '@/types';
import { generateTagsForAnalysis } from '@/utils/tagUtils';
import { buildCakeTitle, extractTitleInputFromAnalysis } from './cakeTitle';
import { enrichStoredSeoDescription } from './analysisCopy';
import { getDesignAvailability, type AvailabilityType } from '@/lib/utils/availability';

export interface GeneratedSeoCopy {
  alt_text: string;
  seo_description: string;
}

/** Copy generation receives design evidence, never the old copy or personal message text. */
export function buildSeoBatchInput(analysis: HybridAnalysisResult) {
  return {
    cakeType: analysis.cakeType,
    cakeThickness: analysis.cakeThickness,
    keyword: analysis.keyword,
    icing_design: analysis.icing_design,
    main_toppers: analysis.main_toppers,
    support_elements: analysis.support_elements,
    has_personalized_message: Boolean(analysis.cake_messages?.length),
  };
}

export function buildSeoPublicationMetadata(
  analysis: HybridAnalysisResult,
  copy: GeneratedSeoCopy,
  storedAvailability?: string | null,
) {
  const altText = typeof copy.alt_text === 'string' ? copy.alt_text.trim() : '';
  const description = typeof copy.seo_description === 'string' ? copy.seo_description.trim() : '';
  if (altText.length < 18 || altText.length > 160 || description.length < 80) {
    throw new Error('SEO copy is missing or outside the publication length limits.');
  }
  if (/https?:|www\.|genie\.ph|₱|\bPHP\b|\border now\b|\bstarting at\b/i.test(`${altText} ${description}`)) {
    throw new Error('SEO copy contains a prohibited brand, price, URL, or ordering instruction.');
  }
  if (/wafer[ -]?paper|\bwafer\b/i.test(`${altText} ${description}`)
    && !analysis.support_elements?.some(item => item.type === 'edible_photo_side_wave')) {
    throw new Error('SEO copy describes wafer paper without verified analysis evidence.');
  }

  const availability: AvailabilityType = storedAvailability === 'rush'
    || storedAvailability === 'same-day' || storedAvailability === 'normal'
    ? storedAvailability
    : getDesignAvailability({
      cakeType: analysis.cakeType,
      cakeSize: '6" Round',
      icingBase: analysis.icing_design?.base || 'soft_icing',
      drip: analysis.icing_design?.drip || false,
      gumpasteBaseBoard: analysis.icing_design?.gumpasteBaseBoard || false,
      mainToppers: (analysis.main_toppers || []).map(item => ({ type: item.type, description: item.description || '' })),
      supportElements: (analysis.support_elements || []).map(item => ({ type: item.type, description: item.description || '' })),
    });
  // Existing deterministic title rules are deliberately independent of generated copy.
  const tags = generateTagsForAnalysis(analysis, analysis.keyword || '', null, null);
  const seoTitle = buildCakeTitle(extractTitleInputFromAnalysis(analysis, analysis.keyword, tags));
  // Do not let fallback enrichment quote personalized messages from the source JSON.
  const publicAnalysis = { ...analysis, cake_messages: [] };
  return {
    seo_title: seoTitle,
    seo_description: enrichStoredSeoDescription({
      analysisResult: publicAnalysis,
      availability,
      keywords: analysis.keyword,
      rawDescription: description,
      tags,
    }),
    alt_text: altText,
    tags,
  };
}
