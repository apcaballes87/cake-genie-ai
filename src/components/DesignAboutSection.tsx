import React from 'react';

interface DesignAboutSectionProps {
    title: string;
    description: string;
    showDisclaimer?: boolean;
}

export const DesignAboutSection: React.FC<DesignAboutSectionProps> = ({
    title,
    description,
    showDisclaimer = false
}) => {
    if (!description) return null;

    return (
        <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">{title}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
                {description}
            </p>
            {showDisclaimer && (
                <p className="text-xs text-red-400 mt-4 flex items-center justify-center gap-1.5 text-center">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Design inspiration shared by customer for pricing—final cake may vary slightly.
                </p>
            )}
        </div>
    );
};
