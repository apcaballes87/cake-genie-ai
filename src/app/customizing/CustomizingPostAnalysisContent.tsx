import React, { useMemo } from 'react';
import { DesignAboutSection } from '@/components/DesignAboutSection';
import type { BasePriceInfo, HybridAnalysisResult } from '@/types';
import { generateDynamicFAQ } from '@/utils/designContentUtils';

interface CustomizingPostAnalysisContentProps {
    analysisResult: HybridAnalysisResult;
    keywords: string;
    availability?: string | null;
    tags?: string[] | null;
    aboutDescription?: string | null;
    basePriceOptions: BasePriceInfo[];
}

export const CustomizingPostAnalysisContent = React.memo(({
    analysisResult,
    keywords,
    availability,
    tags,
    aboutDescription,
    basePriceOptions,
}: CustomizingPostAnalysisContentProps) => {
    const faqs = useMemo(() => generateDynamicFAQ({
        keywords,
        analysis_json: analysisResult,
        availability: availability || 'normal',
        tags: tags || [],
    }, basePriceOptions), [analysisResult, availability, basePriceOptions, keywords, tags]);

    const primaryFeatures = useMemo(
        () => analysisResult.main_toppers.map((topper) => topper.description || topper.type).join(', '),
        [analysisResult.main_toppers]
    );

    const decorations = useMemo(
        () => analysisResult.support_elements.map((element) => element.description || element.type).join(', '),
        [analysisResult.support_elements]
    );

    return (
        <div className="w-full max-w-4xl mx-auto px-0 pb-4 pt-1 space-y-4">
            {aboutDescription && (
                <section className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 p-4 md:p-6">
                    <DesignAboutSection
                        title={`About This ${keywords || 'Custom'} Cake`}
                        description={aboutDescription}
                        showDisclaimer={true}
                    />
                </section>
            )}

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
                                    <td className="px-4 py-2 text-slate-600">{tags?.join(', ')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

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