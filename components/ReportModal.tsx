import React, { useState, useEffect } from 'react';
import { CloseIcon, Loader2 } from './icons';
import { CartItemDetails, CakeInfoUI, CakeType } from '../types';
import DetailItem from './UI/DetailItem';

const cakeTypeDisplayMap: Record<CakeType, string> = {
    '1 Tier': '1 Tier (Soft icing)',
    '2 Tier': '2 Tier (Soft icing)',
    '3 Tier': '3 Tier (Soft icing)',
    '1 Tier Fondant': '1 Tier Fondant',
    '2 Tier Fondant': '2 Tier Fondant',
    '3 Tier Fondant': '3 Tier Fondant',
    'Square': 'Square',
    'Rectangle': 'Rectangle',
    'Bento': 'Bento',
};

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (feedback: string) => Promise<void>;
    isSubmitting: boolean;
    editedImage: string | null;
    details: CartItemDetails | null;
    cakeInfo: CakeInfoUI | null;
}

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, onSubmit, isSubmitting, editedImage, details, cakeInfo }) => {
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setFeedback(''); // Clear feedback when modal closes
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        onSubmit(feedback);
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-200 animate-fade-in"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-5 flex justify-between items-center border-b border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800">Report an Issue</h2>
                    <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Close">
                        <CloseIcon />
                    </button>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[70vh] overflow-y-auto">
                    <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">Generated Image</p>
                        {editedImage ? (
                            <img src={editedImage} alt="Customized Cake" className="w-full h-auto object-contain rounded-lg border border-slate-200" />
                        ) : (
                            <div className="aspect-square bg-slate-100 flex items-center justify-center rounded-lg">
                                <span className="text-slate-400 text-sm">No image generated</span>
                            </div>
                        )}
                    </div>
                    <div className="space-y-3">
                        <p className="text-sm font-semibold text-slate-700">Customization Details</p>
                        <div className="space-y-1.5 p-3 bg-slate-50 rounded-md border border-slate-200">
                            {cakeInfo && details && (
                                <>
                                    <DetailItem label="Type" value={`${cakeTypeDisplayMap[cakeInfo.type]}, ${cakeInfo.thickness}, ${cakeInfo.size}`} />
                                    {details.flavors.map((flavor, idx) => (
                                        <DetailItem key={idx} label={`Tier ${idx + 1} Flavor`} value={flavor} />
                                    ))}
                                    {details.mainToppers.length > 0 && <DetailItem label="Main Toppers" value={details.mainToppers.map(t => t.description).join(', ')} />}
                                    {details.supportElements.length > 0 && <DetailItem label="Support" value={details.supportElements.map(s => s.description).join(', ')} />}
                                    {details.cakeMessages.map((msg, idx) => (
                                      <DetailItem key={idx} label={`Message #${idx+1}`} value={`'${msg.text}' (${msg.color})`} />
                                   ))}
                                   {details.icingDesign.drip && <DetailItem label="Design" value="Has Drip Effect" />}
                                    {details.icingDesign.gumpasteBaseBoard && <DetailItem label="Design" value="Gumpaste Base Board" />}
                                    {Object.entries(details.icingDesign.colors).map(([loc, color]) => {
                                        const colorLabelMap: Record<string, string> = {
                                            side: 'Side', top: 'Top', borderTop: 'Top Border', borderBase: 'Base Border', drip: 'Drip', gumpasteBaseBoardColor: 'Base Board'
                                        };
                                        return <DetailItem key={loc} label={`${colorLabelMap[loc] || loc} Color`} value={color} />;
                                    })}
                                    {details.additionalInstructions && <DetailItem label="Instructions" value={details.additionalInstructions} />}
                                </>
                            )}
                        </div>
                        <div>
                             <label htmlFor="report-feedback" className="text-sm font-semibold text-slate-700 mb-2 block">Your Feedback</label>
                             <textarea
                                 id="report-feedback"
                                 value={feedback}
                                 onChange={(e) => setFeedback(e.target.value)}
                                 className="w-full p-3 text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                 placeholder="Please describe the issue. For example: 'The topper was removed instead of changed', 'The drip color is wrong', etc."
                                 rows={4}
                             />
                        </div>
                    </div>
                </div>
                <div className="p-5 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-2 px-6 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center"
                    >
                        {isSubmitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sending...</> : 'Send Report'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportModal;