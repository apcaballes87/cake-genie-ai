

import React, { useState, useCallback, useMemo } from 'react';
import { useImageManagement } from '../../hooks/useImageManagement';
import { useCakeCustomization } from '../../hooks/useCakeCustomization';
import { usePricing } from '../../hooks/usePricing';
import { savePricingFeedback } from '../../services/supabaseService';
import { ImageUploader } from '../../components/ImageUploader';
import { LoadingSpinner } from '../../components/LoadingSpinner';
// FIX: Imported Loader2 to fix render error.
import { ArrowLeft, Upload, Save, CheckCircle, Loader2 } from 'lucide-react';
import { showError, showSuccess } from '../../lib/utils/toast';
// FIX: Imported PricingFeedback from types instead of supabaseService.
import { AddOnPricing, HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, PricingFeedback } from '../../types';

interface PricingSandboxPageProps {
  onClose: () => void;
}

const ItemRow: React.FC<{ item: { id: string; description: string; price: number; }, expertPrice: number, onPriceChange: (price: number) => void }> = ({ item, expertPrice, onPriceChange }) => (
    <tr className="border-b border-slate-200">
        <td className="py-2 px-3 text-sm text-slate-600">{item.description}</td>
        <td className="py-2 px-3 text-sm text-slate-800 font-semibold text-right">₱{item.price.toFixed(2)}</td>
        <td className="py-2 px-3">
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₱</span>
                <input
                    type="number"
                    value={expertPrice}
                    onChange={(e) => onPriceChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-6 pr-2 py-1.5 text-sm text-right bg-white border border-slate-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500"
                />
            </div>
        </td>
    </tr>
);

const PricingSandboxPage: React.FC<PricingSandboxPageProps> = ({ onClose }) => {
    const [isUploaderOpen, setIsUploaderOpen] = useState(false);
    const [expertPrices, setExpertPrices] = useState<Record<string, number>>({});
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedId, setLastSavedId] = useState<string | null>(null);
    
    const {
        originalImageData,
        originalImagePreview,
        handleImageUpload: hookImageUpload,
        clearImages,
    } = useImageManagement();

    const {
        cakeInfo, mainToppers, supportElements, cakeMessages, icingDesign,
        analysisResult, analysisId, isAnalyzing, analysisError,
        setIsAnalyzing, setAnalysisError, setPendingAnalysisData,
        clearCustomization, initializeDefaultState
    } = useCakeCustomization();

    const { addOnPricing, pricingRules } = usePricing({
        analysisResult, mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo,
        onCakeInfoCorrection: () => {}, // No-op for sandbox
        analysisId
    });

    const handleImageUpload = useCallback((file: File) => {
        clearImages();
        clearCustomization();
        setExpertPrices({});
        setNotes('');
        setLastSavedId(null);
        setIsAnalyzing(true);
        setAnalysisError(null);
        initializeDefaultState();

        hookImageUpload(
            file,
            (result) => {
                setPendingAnalysisData(result);
                setIsAnalyzing(false);
            },
            (error) => {
                setAnalysisError(error.message);
                showError(error.message);
                setIsAnalyzing(false);
            }
        );
    }, [clearImages, clearCustomization, initializeDefaultState, hookImageUpload, setPendingAnalysisData, setIsAnalyzing, setAnalysisError]);

    // FIX: Correctly map all items to a consistent structure with a `description` property.
    const allItems = useMemo(() => {
        if (!addOnPricing) return [];

        const itemsWithDescription = [
            ...mainToppers,
            ...supportElements,
            ...cakeMessages.map(m => ({ ...m, description: `Message: "${m.text}"`})),
        ];

        const allPossibleItems: Array<{ id: string, description: string, price: number, isEnabled?: boolean }> = [...itemsWithDescription];
        
        if (icingDesign?.drip) {
            allPossibleItems.push({ id: 'drip', description: 'Drip Effect', price: icingDesign.dripPrice });
        }
        if (icingDesign?.gumpasteBaseBoard) {
            allPossibleItems.push({ id: 'baseboard', description: 'Gumpaste Base Board', price: icingDesign.gumpasteBaseBoardPrice });
        }
        
        return allPossibleItems.filter(item => item.isEnabled === undefined || item.isEnabled);
    }, [mainToppers, supportElements, cakeMessages, icingDesign, addOnPricing]);

    const expertTotalPrice = useMemo(() => {
        // FIX: Added explicit types to the reduce callback parameters (`sum` and `price`)
        // to resolve the TypeScript error "Operator '+' cannot be applied to types 'unknown' and 'unknown'".
        return Object.values(expertPrices).reduce((sum: number, price: number) => sum + price, 0);
    }, [expertPrices]);

    const handlePriceChange = (itemId: string, price: number) => {
        setExpertPrices(prev => ({ ...prev, [itemId]: price }));
    };

    const handleSaveFeedback = async () => {
        if (!analysisResult || !originalImagePreview) {
            showError("An analysis must be complete before saving feedback.");
            return;
        }

        setIsSaving(true);
        try {
            const feedbackData: PricingFeedback = {
                original_image_url: originalImagePreview, // Using data URI for now
                ai_analysis: analysisResult,
                corrections: Object.fromEntries(
                    allItems.map(item => [item.id, {
                        ai_price: item.price,
                        expert_price: expertPrices[item.id] ?? item.price // Default to AI price if not overridden
                    }])
                ),
                ai_total_price: addOnPricing?.addOnPrice ?? 0,
                expert_total_price: expertTotalPrice,
                notes: notes.trim() || undefined,
            };

            await savePricingFeedback(feedbackData);
            setLastSavedId(analysisId);
            showSuccess("Feedback saved successfully!");

        } catch (error) {
            showError(error instanceof Error ? error.message : "Failed to save feedback.");
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="w-full max-w-6xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
                    <ArrowLeft />
                </button>
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">Pricing Sandbox</h1>
                    <p className="text-sm text-slate-500">An internal tool to test and improve AI pricing analysis.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Image & Upload */}
                <div className="space-y-4">
                    <div className="relative w-full aspect-square bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden">
                        {isAnalyzing && (
                            <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10">
                                <LoadingSpinner />
                                <p className="mt-4 text-slate-600 font-semibold">Analyzing Image...</p>
                            </div>
                        )}
                        {originalImagePreview ? (
                            <img src={originalImagePreview} alt="Uploaded Cake" className="w-full h-full object-contain" />
                        ) : (
                            <div className="text-center text-slate-500">
                                <p>Upload an image to begin.</p>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setIsUploaderOpen(true)}
                        className="w-full flex items-center justify-center gap-2 bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all"
                    >
                        <Upload size={20} />
                        {originalImagePreview ? 'Upload a Different Image' : 'Upload Image'}
                    </button>
                    {analysisError && <p className="text-sm text-red-600 text-center">{analysisError}</p>}
                </div>

                {/* Right Column: Analysis & Feedback */}
                <div className="bg-white/80 p-6 rounded-2xl shadow-lg border border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800 mb-4">AI Analysis & Price Correction</h2>
                    
                    {!analysisResult ? (
                        <div className="text-center py-16 text-slate-500">
                            <p>Analysis results will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <table className="w-full table-auto">
                                <thead className="text-left">
                                    <tr className="border-b-2 border-slate-300">
                                        <th className="py-2 px-3 text-sm font-semibold text-slate-600">Item Description</th>
                                        <th className="py-2 px-3 text-sm font-semibold text-slate-600 text-right">AI Price</th>
                                        <th className="py-2 px-3 text-sm font-semibold text-slate-600 text-right">Your Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allItems.map(item => (
                                        <ItemRow
                                            key={item.id}
                                            item={item}
                                            expertPrice={expertPrices[item.id] ?? item.price}
                                            onPriceChange={(price) => handlePriceChange(item.id, price)}
                                        />
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-300 font-bold">
                                        <td className="py-3 px-3 text-slate-800">Total Add-on Price</td>
                                        <td className="py-3 px-3 text-pink-600 text-right">₱{addOnPricing?.addOnPrice.toFixed(2)}</td>
                                        <td className="py-3 px-3 text-green-600 text-right">₱{expertTotalPrice.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>

                             <div>
                                <label htmlFor="notes" className="block text-sm font-medium text-slate-600 mb-1">Notes (Optional)</label>
                                <textarea
                                    id="notes"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500"
                                    placeholder="e.g., The AI misidentified the material of the unicorn topper."
                                    rows={3}
                                />
                            </div>

                            <button
                                onClick={handleSaveFeedback}
                                disabled={isSaving || lastSavedId === analysisId}
                                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 size={20} className="animate-spin" /> : 
                                 lastSavedId === analysisId ? <CheckCircle size={20} /> : <Save size={20} />}
                                {isSaving ? 'Saving...' : lastSavedId === analysisId ? 'Feedback Saved!' : 'Save Feedback'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <ImageUploader
                isOpen={isUploaderOpen}
                onClose={() => setIsUploaderOpen(false)}
                onImageSelect={(file) => {
                    handleImageUpload(file);
                    setIsUploaderOpen(false);
                }}
            />
        </div>
    );
};

export default PricingSandboxPage;