'use client';

import { memo, type ComponentProps } from 'react';
import { ChosenOptionsSkeleton } from '../../components/LoadingSkeletons';
import { MagicSparkleIcon } from '../../components/icons';
import { CustomizingAiChatPanel } from './CustomizingAiChatPanel';
import { CustomizingStepSummarySections } from './CustomizingStepSummarySections';

interface CustomizingSidebarPanelProps {
    showLoadingState: boolean;
    showContentState: boolean;
    showAiChat: boolean;
    aiChatProps: Omit<ComponentProps<typeof CustomizingAiChatPanel>, 'className'>;
    stepSummaryProps: Omit<ComponentProps<typeof CustomizingStepSummarySections>, 'layout'>;
}

export const CustomizingSidebarPanel = memo(function CustomizingSidebarPanel({
    showLoadingState,
    showContentState,
    showAiChat,
    aiChatProps,
    stepSummaryProps,
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
            ) : showContentState ? (
                <>
                    {showAiChat ? (
                        <CustomizingAiChatPanel
                            {...aiChatProps}
                            className="w-full hidden md:block bg-white/70 backdrop-blur-lg p-2 rounded-2xl shadow-lg border border-slate-200 relative z-30"
                        />
                    ) : null}

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