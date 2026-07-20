import React, { useMemo } from 'react';
import { ImagePlus, Truck, Zap } from 'lucide-react';
import { DesignAboutSection } from '@/components/DesignAboutSection';
import type { BasePriceInfo, HybridAnalysisResult } from '@/types';
import { buildDesignPageContent } from '@/utils/designContentUtils';

interface CustomizingPostAnalysisContentProps {
    analysisResult: HybridAnalysisResult;
    keywords: string;
    availability?: string | null;
    tags?: string[] | null;
    seoDescription?: string | null;
    altText?: string | null;
    basePriceOptions: BasePriceInfo[];
    onUploadAnother: () => void;
}

export const CustomizingPostAnalysisContent = React.memo(({
    analysisResult,
    keywords,
    availability,
    tags,
    seoDescription,
    altText,
    basePriceOptions,
    onUploadAnother,
}: CustomizingPostAnalysisContentProps) => {
    const pageContent = useMemo(() => buildDesignPageContent({
        keywords,
        analysis_json: analysisResult,
        availability: availability || 'normal',
        tags: tags || [],
        seo_description: seoDescription || null,
        alt_text: altText || null,
    }, basePriceOptions), [altText, analysisResult, availability, basePriceOptions, keywords, seoDescription, tags]);
    const faqs = pageContent.faqs;

    const primaryFeatures = useMemo(
        () => analysisResult.main_toppers.map((topper) => topper.description || topper.type).join(', '),
        [analysisResult.main_toppers]
    );

    const decorations = useMemo(
        () => analysisResult.support_elements.map((element) => element.description || element.type).join(', '),
        [analysisResult.support_elements]
    );

    return (
        <div className="w-full pb-4 pt-1 space-y-4">
            <div className="flex w-full flex-col items-center gap-2 pb-4 max-md:pt-4">
                <button
                    type="button"
                    onClick={onUploadAnother}
                    className="genie-btn-primary flex w-full max-w-[520px] items-center justify-center gap-2 rounded-[1.5rem] px-4 py-3 text-sm font-bold shadow-md shadow-purple-50/50 transition-transform active:scale-[0.98] md:text-base"
                >
                    <ImagePlus size={18} className="shrink-0" aria-hidden="true" />
                    <span>Upload Any Design - Get Instant Pricing</span>
                </button>

                <div className="flex w-full max-w-[520px] items-center justify-center gap-x-2 text-[9px] font-bold uppercase tracking-wide text-neutral-500 sm:text-[10px] md:text-[11px]">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                        <ImagePlus size={13} className="shrink-0 text-neutral-400" aria-hidden="true" />
                        <span>Any Cake Image</span>
                    </div>
                    <span className="text-neutral-300" aria-hidden="true">•</span>
                    <div className="flex items-center gap-1 whitespace-nowrap">
                        <Zap size={13} className="shrink-0 text-neutral-400" aria-hidden="true" />
                        <span>Instant AI Pricing</span>
                    </div>
                    <span className="text-neutral-300" aria-hidden="true">•</span>
                    <div className="flex items-center gap-1 whitespace-nowrap">
                        <Truck size={13} className="shrink-0 text-neutral-400" aria-hidden="true" />
                        <span>Same-day Delivery</span>
                    </div>
                </div>
            </div>

            <section className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 p-4 md:p-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4 text-center">Design Specifications</h2>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm text-left">
                        <tbody className="divide-y divide-slate-200">
                            <tr className="bg-white">
                                <th className="px-4 py-2 font-semibold text-slate-700 w-1/3">Cake Style</th>
                                <td className="px-4 py-2 text-slate-600">{analysisResult.cakeType || 'Custom'} {keywords}</td>
                            </tr>
                            <tr className="bg-slate-50">
                                <th className="px-4 py-2 font-semibold text-slate-700 w-1/3">Icing Finish</th>
                                <td className="px-4 py-2 text-slate-600">{analysisResult.icing_design?.base?.replace(/_/g, ' ') || 'Standard Icing'}</td>
                            </tr>
                            {primaryFeatures && (
                                <tr className="bg-white">
                                    <th className="px-4 py-2 font-semibold text-slate-700 w-1/3">Primary Features</th>
                                    <td className="px-4 py-2 text-slate-600">{primaryFeatures}</td>
                                </tr>
                            )}
                            {decorations && (
                                <tr className="bg-slate-50">
                                    <th className="px-4 py-2 font-semibold text-slate-700 w-1/3">Decorations</th>
                                    <td className="px-4 py-2 text-slate-600">{decorations}</td>
                                </tr>
                            )}
                            {(tags?.length ?? 0) > 0 && (
                                <tr className="bg-white">
                                    <th className="px-4 py-2 font-semibold text-slate-700 w-1/3">Tags</th>
                                    <td className="px-4 py-2 text-slate-600">
                                        <div className="flex flex-wrap gap-1.5">
                                            {tags?.map((tag, index) => (
                                                <span
                                                    key={`${tag}-${index}`}
                                                    className="text-slate-600"
                                                >
                                                    {tag}{index < (tags?.length ?? 0) - 1 ? ',' : ''}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {pageContent.description && (
                <section className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 p-4 md:p-6">
                    <DesignAboutSection
                        title={`About This ${keywords || 'Custom'} Cake`}
                        description={pageContent.description}
                        showDisclaimer={true}
                    />
                </section>
            )}

            {faqs.length > 0 && (
                <section className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 p-4 md:p-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-4 text-center">Frequently Asked Questions</h2>
                    <div className="space-y-3">
                        {faqs.map((faq, index) => (
                            <details
                                key={faq.question}
                                className="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-md"
                                {...(index === 0 ? { open: true } : {})}
                            >
                                <summary className="flex items-center justify-between p-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                    <span className="font-semibold text-slate-700 group-open:text-purple-900 text-sm">{faq.question}</span>
                                    <svg className="w-5 h-5 text-slate-400 transition-transform duration-300 group-open:rotate-180 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </summary>
                                <div className="px-4 pb-4 text-sm text-slate-600 leading-relaxed">{faq.answer}</div>
                            </details>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
});

CustomizingPostAnalysisContent.displayName = 'CustomizingPostAnalysisContent';
