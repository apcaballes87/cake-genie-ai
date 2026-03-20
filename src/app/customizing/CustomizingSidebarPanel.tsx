'use client';

import { memo, type ComponentProps } from 'react';
import { ChosenOptionsSkeleton } from '../../components/LoadingSkeletons';
import { MagicSparkleIcon, ErrorIcon } from '../../components/icons';
import { CustomizingStepSummarySections } from './CustomizingStepSummarySections';

interface CustomizingSidebarPanelProps {
    showLoadingState: boolean;
    showContentState: boolean;
    stepSummaryProps: Omit<ComponentProps<typeof CustomizingStepSummarySections>, 'layout'>;
    analysisError?: string | null;
    onUploadAnother?: () => void;
    onGoBackHome?: () => void;
}

export const CustomizingSidebarPanel = memo(function CustomizingSidebarPanel({
    showLoadingState,
    showContentState,
    stepSummaryProps,
    analysisError,
    onUploadAnother,
    onGoBackHome,
}: CustomizingSidebarPanelProps) {
    return (
        <div className="w-full flex-col gap-2 hidden md:flex">
            {showLoadingState ? (
                <div className="bg-white/70 backdrop-blur-lg p-2 rounded-2xl shadow-lg border border-slate-200">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <MagicSparkleIcon className="w-5 h-5 text-purple-600 animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Analyzing Design...</h2>
                            <p className="text-xs text-slate-500">Extracting features and generating options</p>
                        </div>
                    </div>
                    <div className="mt-6">
                        <ChosenOptionsSkeleton />
                    </div>
                    <div className="mt-4 px-2">
                        <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200/50 animate-pulse">
                            <div className="h-4 w-32 bg-slate-200 rounded" />
                            <div className="h-16 w-full bg-slate-200 rounded" />
                        </div>
                    </div>
                </div>
            ) : analysisError ? (
                <div className="text-center p-6 bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-red-200 flex flex-col items-center justify-center gap-4">
                    <div className="text-red-500 bg-red-50 p-3 rounded-full">
                        <ErrorIcon className="w-8 h-8" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-800">Analysis Error</h2>
                    <p className="text-slate-600 mb-2">{analysisError.replace('AI_REJECTION: ', '')}</p>
                    
                    <div className="bg-orange-50 text-orange-800 text-sm p-4 rounded-xl text-left space-y-2 mb-2 w-full">
                        <p className="font-semibold text-orange-900 border-b border-orange-200 pb-1 mb-2">Tips for better results:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Only add images with 1 cake</li>
                            <li>We only process cakes 1 to 3 tiers (for now)</li>
                            <li>Use clear, well-lit images</li>
                        </ul>
                    </div>
                    
                    <div className="flex flex-col gap-2 w-full mt-2">
                        <button 
                            onClick={onUploadAnother}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-xl transition-colors w-full"
                        >
                            Upload Another
                        </button>
                        <button 
                            onClick={onGoBackHome}
                            className="bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 px-4 rounded-xl border border-slate-200 transition-colors w-full"
                        >
                            Go Back Home
                        </button>
                    </div>
                </div>
            ) : showContentState ? (
                <>
                    <CustomizingStepSummarySections
                        {...stepSummaryProps}
                        layout="desktop"
                    />
                </>
            ) : (
                <div className="text-center p-8 bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 text-slate-500">
                    <p>Upload an image to get started.</p>
                </div>
            )}
        </div>
    );
});

CustomizingSidebarPanel.displayName = 'CustomizingSidebarPanel';