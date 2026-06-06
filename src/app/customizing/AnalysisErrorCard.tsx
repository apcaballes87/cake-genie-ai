'use client';

import { ErrorIcon } from '@/components/icons';
import { isAiServiceOutageError } from './analysisErrorDisplay';

interface AnalysisErrorCardProps {
    analysisError: string;
    onUploadAnother?: () => void;
    onGoBackHome?: () => void;
    onBrowseGallery?: () => void;
    onSearchDesigns?: () => void;
    className?: string;
}
export function AnalysisErrorCard({
    analysisError,
    onUploadAnother,
    onGoBackHome,
    onBrowseGallery,
    onSearchDesigns,
    className = '',
}: AnalysisErrorCardProps) {
    const isServiceOutage = isAiServiceOutageError(analysisError);

    return (
        <div className={`text-center p-6 genie-card rounded-2xl flex flex-col items-center justify-center gap-4 ${isServiceOutage ? 'border-purple-200' : 'border-red-200'} ${className}`}>
            <div className={isServiceOutage ? 'text-purple-600 bg-purple-50 p-3 rounded-full' : 'text-red-500 bg-red-50 p-3 rounded-full'}>
                <ErrorIcon className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">
                {isServiceOutage ? 'Our AI service is temporarily offline' : 'Analysis Error'}
            </h2>
            <p className="text-slate-600 mb-2">
                {isServiceOutage
                    ? 'We could not analyze your upload right now. You can still find a cake design from our gallery.'
                    : analysisError.replace('AI_REJECTION: ', '')}
            </p>

            {isServiceOutage ? (
                <div className="flex flex-col gap-2 w-full mt-2">
                    <button
                        onClick={onBrowseGallery}
                        className="genie-btn-primary font-bold py-3 px-4 rounded-xl w-full"
                    >
                        Browse 10,000+ Cake Designs
                    </button>
                    <button
                        onClick={onSearchDesigns}
                        className="genie-btn-secondary font-bold py-3 px-4 rounded-xl w-full"
                    >
                        Search Cake Designs
                    </button>
                </div>
            ) : (
                <>
                    <div className="bg-orange-50 text-orange-800 text-sm p-4 rounded-xl text-left space-y-2 mb-2 w-full">
                        <p className="font-semibold text-orange-900 border-b border-orange-200 pb-1 mb-2">Tips for better results:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Only add images with 1 cake</li>
                            <li>We only process cakes 1 to 3 tiers (for now)</li>
                            <li>Use clear, well-lit images</li>
                        </ul>
                    </div>

                    <div className="flex flex-col gap-2 w-full mt-2">
                        <button onClick={onUploadAnother} className="genie-btn-primary font-bold py-3 px-4 rounded-xl w-full">
                            Upload Another
                        </button>
                        <button onClick={onGoBackHome} className="genie-btn-secondary font-bold py-3 px-4 rounded-xl w-full">
                            Go Back Home
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
