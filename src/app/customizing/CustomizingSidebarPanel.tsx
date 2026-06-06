'use client';

import { memo, type ComponentProps } from 'react';
import { ChosenOptionsSkeleton } from '../../components/LoadingSkeletons';
import { MagicSparkleIcon } from '../../components/icons';
import { AnalysisErrorCard } from './AnalysisErrorCard';
import { CustomizingStepSummarySections } from './CustomizingStepSummarySections';

interface CustomizingSidebarPanelProps {
    showLoadingState: boolean;
    showContentState: boolean;
    stepSummaryProps: Omit<ComponentProps<typeof CustomizingStepSummarySections>, 'layout'>;
    analysisError?: string | null;
    onUploadAnother?: () => void;
    onGoBackHome?: () => void;
    onBrowseGallery?: () => void;
    onSearchDesigns?: () => void;
    onUpdateDesign?: () => void;
    isUpdatingDesign?: boolean;
    dirtyFields?: Set<string>;
    className?: string;
}

export const CustomizingSidebarPanel = memo(function CustomizingSidebarPanel({
    showLoadingState,
    showContentState,
    stepSummaryProps,
    analysisError,
    onUploadAnother,
    onGoBackHome,
    onBrowseGallery,
    onSearchDesigns,
    onUpdateDesign,
    isUpdatingDesign,
    dirtyFields,
    className = 'w-full flex-col gap-2 hidden md:flex',
}: CustomizingSidebarPanelProps) {
    return (
        <div className={className}>
            {showLoadingState ? (
                <div className="genie-card p-2 rounded-2xl">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-purple-100">
                        <div className="p-2 genie-icon-soft rounded-lg">
                            <MagicSparkleIcon className="w-5 h-5 animate-pulse" />
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
                <AnalysisErrorCard
                    analysisError={analysisError}
                    onUploadAnother={onUploadAnother}
                    onGoBackHome={onGoBackHome}
                    onBrowseGallery={onBrowseGallery}
                    onSearchDesigns={onSearchDesigns}
                />
            ) : showContentState ? (
                <>
                    <CustomizingStepSummarySections
                        {...stepSummaryProps}
                        layout="desktop"
                        onUpdateDesign={onUpdateDesign}
                        isUpdatingDesign={isUpdatingDesign}
                        dirtyFields={dirtyFields}
                    />
                </>
            ) : (
                <div className="text-center p-8 genie-card rounded-2xl text-slate-500">
                    <p>Upload an image to get started.</p>
                </div>
            )}
        </div>
    );
});

CustomizingSidebarPanel.displayName = 'CustomizingSidebarPanel';
