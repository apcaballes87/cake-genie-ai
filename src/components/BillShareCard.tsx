// components/BillShareCard.tsx

import React, { useState, useMemo } from 'react';
import { Share2, Link as LinkIcon, CheckCircle, Users, ChevronDown, Calendar, MapPin, User as UserIcon } from 'lucide-react';
import LazyImage from './LazyImage';
import { showSuccess } from '../lib/utils/toast';
import DetailItem from './UI/DetailItem';
import { ImageZoomModal } from './ImageZoomModal';
import { CartItemDetails } from '../types';

interface BillShareCardProps {
    design: any;
    onDesignUpdate: (updatedDesign: any) => void;
}

const BillShareCard: React.FC<BillShareCardProps> = ({ design, onDesignUpdate }) => {
    const [isCopied, setIsCopied] = useState(false);
    const [zoomState, setZoomState] = useState<{ isOpen: boolean; initialTab: 'original' | 'customized' }>({
        isOpen: false,
        initialTab: 'customized',
    });

    const { amountCollected, contributorCount } = useMemo(() => {
        if (!design || !design.contributions || !Array.isArray(design.contributions)) {
            return { amountCollected: design?.amount_collected || 0, contributorCount: 0 };
        }
        const paidContributions = design.contributions.filter((c: any) => c.status === 'paid');
        const totalFromContributions = paidContributions.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
        return {
            amountCollected: Math.max(totalFromContributions, design.amount_collected || 0),
            contributorCount: paidContributions.length
        };
    }, [design]);
    
    const progress = design.final_price > 0 ? Math.min(100, (amountCollected / design.final_price) * 100) : 0;
    const remainingAmount = design.final_price - amountCollected;
    const isFullyFunded = remainingAmount <= 0;

    const shareUrl = `${window.location.origin}/#/designs/${design.url_slug}`;

    const handleCopyLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(shareUrl).then(() => {
            setIsCopied(true);
            showSuccess("Share link copied!");
            setTimeout(() => setIsCopied(false), 2000);
        });
    };
    
    const getStatusInfo = () => {
        if (design.order_placed) {
            return { text: "Order Placed", style: "bg-green-100 text-green-800" };
        }
        if (isFullyFunded) {
            return { text: "Fully Funded", style: "bg-blue-100 text-blue-800" };
        }
        return { text: "Funding in Progress", style: "bg-yellow-100 text-yellow-800" };
    };

    const { text: statusText, style: statusStyle } = getStatusInfo();
    const designDate = new Date(design.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const details = design.customization_details as CartItemDetails | undefined;
    const tierLabels = details?.flavors?.length === 2 ? ['Top Tier', 'Bottom Tier'] : details?.flavors?.length === 3 ? ['Top Tier', 'Middle Tier', 'Bottom Tier'] : ['Flavor'];
    const colorLabelMap: Record<string, string> = { side: 'Side', top: 'Top', borderTop: 'Top Border', borderBase: 'Base Border', drip: 'Drip', gumpasteBaseBoardColor: 'Base Board' };
    const deliveryDate = design.event_date ? new Date(design.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : null;


    return (
        <>
            <details className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group">
                <summary className="p-4 cursor-pointer list-none">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold text-slate-800 leading-tight">{design.title}</p>
                            <p className="text-xs text-slate-500 mt-1">Created on {designDate}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                            <p className="text-lg font-bold text-pink-600">₱{design.final_price.toLocaleString()}</p>
                            <p className="text-xs text-slate-500">1 item</p>
                        </div>
                    </div>

                    <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="font-semibold text-slate-600">
                                ₱{amountCollected.toLocaleString()} raised
                            </span>
                            <span className="text-slate-500">
                                {progress.toFixed(0)}%
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2.5">
                            <div 
                                className="bg-gradient-to-r from-pink-500 to-purple-500 h-2.5 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyle}`}>
                                {statusText}
                            </span>
                            {contributorCount > 0 && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                    <Users size={14} />
                                    <span>{contributorCount} contributor{contributorCount > 1 ? 's' : ''}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handleCopyLink} title="Copy Share Link" className="p-2 text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                                {isCopied ? <CheckCircle size={16} className="text-green-600" /> : <Share2 size={16} />}
                            </button>
                            <a href={shareUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="View Page" className="p-2 text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                                <LinkIcon size={16} />
                            </a>
                            <ChevronDown className="w-5 h-5 text-slate-400 transition-transform group-open:rotate-180" />
                        </div>
                    </div>
                </summary>

                <div className="px-4 pb-4 border-t border-slate-200 animate-fade-in">
                    <div className="space-y-4 pt-4">
                        <div>
                            <h4 className="text-sm font-semibold text-slate-800 mb-2">Item</h4>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex gap-4">
                                    <button onClick={() => setZoomState({ isOpen: true, initialTab: 'customized' })} className="w-24 h-24 flex-shrink-0 rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-transform hover:scale-105" aria-label="Enlarge cake image">
                                        <LazyImage src={design.customized_image_url} alt={design.title} className="w-full h-full object-cover" />
                                    </button>
                                    <div className="flex-grow">
                                        <p className="font-semibold text-slate-800">{design.cake_type}</p>
                                        <p className="text-sm text-slate-500">{design.cake_size}</p>
                                        <p className="text-lg font-bold text-pink-600 mt-1">₱{design.final_price.toLocaleString()}</p>
                                    </div>
                                </div>
                                <details className="mt-3">
                                    <summary className="text-xs font-semibold text-slate-600 cursor-pointer">View Customization Details</summary>
                                    <div className="mt-2 pl-2 border-l-2 border-slate-200 space-y-1.5 text-xs text-slate-500">
                                        {details ? (
                                            <>
                                                <DetailItem label="Type" value={`${design.cake_type}, ${design.cake_thickness}, ${design.cake_size}`} />
                                                {details.flavors && details.flavors.length > 0 && (
                                                    details.flavors.length <= 1 
                                                        ? <DetailItem label="Flavor" value={details.flavors[0] || 'N/A'} /> 
                                                        : details.flavors.map((flavor, idx) => (<DetailItem key={idx} label={`${tierLabels[idx]} Flavor`} value={flavor} />))
                                                )}
                                                {details.mainToppers?.length > 0 && <DetailItem label="Main Toppers" value={details.mainToppers.map(t => t.description).join(', ')} />}
                                                {details.supportElements?.length > 0 && <DetailItem label="Support" value={details.supportElements.map(s => s.description).join(', ')} />}
                                                {details.cakeMessages?.map((msg, idx) => (<DetailItem key={idx} label={`Message #${idx+1}`} value={`'${msg.text}' (${msg.color})`} />))}
                                                {details.icingDesign?.drip && <DetailItem label="Icing" value="Has Drip Effect" />}
                                                {details.icingDesign?.gumpasteBaseBoard && <DetailItem label="Icing" value="Gumpaste Base Board" />}
                                                {details.icingDesign?.colors && Object.entries(details.icingDesign.colors).map(([loc, color]) => (<DetailItem key={loc} label={`${colorLabelMap[loc] || loc.charAt(0).toUpperCase() + loc.slice(1)} Color`} value={color} />))}
                                                {details.additionalInstructions && <DetailItem label="Instructions" value={details.additionalInstructions} />}
                                            </>
                                        ) : ( <p className="text-slate-500 text-xs italic">Detailed customization data not available for this older shared design.</p> )}
                                    </div>
                                </details>
                            </div>
                        </div>
                        {deliveryDate && (
                            <div>
                                <h4 className="text-sm font-semibold text-slate-800 mb-2">Delivery Details</h4>
                                <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1.5">
                                    <p className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-2 text-slate-500" /> <span className="font-semibold text-slate-600">Date:</span>&nbsp;{deliveryDate} ({design.event_time})</p>
                                    <p className="flex items-center"><UserIcon className="w-3.5 h-3.5 mr-2 text-slate-500" /> <span className="font-semibold text-slate-600">To:</span>&nbsp;{design.recipient_name}</p>
                                    <p className="flex items-start"><MapPin className="w-3.5 h-3.5 mr-2 text-slate-500 mt-0.5" /> <span className="font-semibold text-slate-600">Address:</span>&nbsp;{`${design.delivery_address}, ${design.delivery_city}`}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </details>
            <ImageZoomModal
                isOpen={zoomState.isOpen}
                onClose={() => setZoomState({ isOpen: false, initialTab: 'customized' })}
                originalImage={design.original_image_url || null}
                customizedImage={design.customized_image_url || null}
                initialTab={zoomState.initialTab}
            />
             <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </>
    );
};

export default BillShareCard;