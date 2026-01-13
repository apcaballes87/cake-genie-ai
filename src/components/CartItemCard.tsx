'use client';
import React from 'react';
import { CartItem } from '@/types';
import DetailItem from './UI/DetailItem';
import { LoadingSpinner } from './LoadingSpinner';
import { TrashIcon } from './icons';
import LazyImage from './LazyImage';

interface CartItemCardProps {
    item: CartItem;
    onRemove: (id: string) => void;
    onZoom: (image: string) => void;
}

const CartItemCard: React.FC<CartItemCardProps> = ({ item, onRemove, onZoom }) => {
    const tierLabels = item.details.flavors.length === 2
        ? ['Top Tier', 'Bottom Tier']
        : item.details.flavors.length === 3
            ? ['Top Tier', 'Middle Tier', 'Bottom Tier']
            : ['Flavor'];

    const colorLabelMap: Record<string, string> = {
        side: 'Side',
        top: 'Top',
        borderTop: 'Top Border',
        borderBase: 'Base Border',
        drip: 'Drip',
        gumpasteBaseBoardColor: 'Base Board'
    };

    if (item.status === 'pending') {
        return (
            <div className="flex flex-col gap-4 p-4 bg-white rounded-lg border border-slate-200">
                <div className="flex gap-4 w-full">
                    <div className="relative w-24 h-24 md:w-32 md:h-32 shrink-0 rounded-md bg-slate-100 overflow-hidden">
                        <LazyImage
                            src={item.image!}
                            alt="Original cake design"
                            className="absolute inset-0 w-full h-full object-cover opacity-40"
                        />
                        <div className="absolute inset-0 bg-slate-900/30 flex flex-col items-center justify-center p-2">
                            <LoadingSpinner />
                            <p className="text-xs text-white font-semibold mt-2 text-center shadow-sm">Updating design...</p>
                        </div>
                    </div>
                    <div className="grow">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="font-semibold text-slate-800">{item.size}</h2>
                                <p className="text-lg font-bold text-purple-600 mt-1">₱{item.totalPrice.toLocaleString()}</p>
                            </div>
                            <button onClick={() => onRemove(item.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors" aria-label="Remove item">
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
                <details className="w-full">
                    <summary className="text-xs font-semibold text-slate-600 cursor-pointer">View Customization Details</summary>
                    <div className="mt-2 pl-2 border-l-2 border-slate-200 space-y-1.5 text-xs text-slate-500">
                        <DetailItem label="Type" value={`${item.type}, ${item.thickness}, ${item.size}`} />
                        {item.details.flavors.length === 1 ? (
                            <DetailItem label="Flavor" value={item.details.flavors[0]} />
                        ) : (
                            item.details.flavors.map((flavor, idx) => (
                                <DetailItem key={idx} label={`${tierLabels[idx]} Flavor`} value={flavor} />
                            ))
                        )}
                        {item.details.mainToppers.length > 0 && <DetailItem label="Main Toppers" value={item.details.mainToppers.map(t => t.description).join(', ')} />}
                        {item.details.supportElements.length > 0 && <DetailItem label="Support" value={item.details.supportElements.map(s => s.description).join(', ')} />}
                        {item.details.cakeMessages.map((msg, idx) => (
                            <DetailItem
                                key={idx}
                                label={`Message #${idx + 1}`}
                                value={
                                    <div className="flex items-center justify-end gap-2">
                                        <span>'{msg.text}'</span>
                                        <div
                                            className="w-4 h-4 rounded-md border border-slate-200 shadow-sm"
                                            style={{ backgroundColor: msg.color }}
                                        />
                                        <span>{msg.color}</span>
                                    </div>
                                }
                            />
                        ))}
                        {item.details.icingDesign.drip && <DetailItem label="Icing" value="Has Drip Effect" />}
                        {item.details.icingDesign.gumpasteBaseBoard && <DetailItem label="Icing" value="Gumpaste Base Board" />}
                        {Object.entries(item.details.icingDesign.colors).map(([loc, color]) => (
                            <DetailItem
                                key={loc}
                                label={`${colorLabelMap[loc] || loc.charAt(0).toUpperCase() + loc.slice(1)} Color`}
                                value={
                                    <div className="flex items-center justify-end gap-2">
                                        <div
                                            className="w-4 h-4 rounded-md border border-slate-200 shadow-sm"
                                            style={{ backgroundColor: color }}
                                        />
                                        <span>{color}</span>
                                    </div>
                                }
                            />
                        ))}
                        {item.details.additionalInstructions && <DetailItem label="Instructions" value={item.details.additionalInstructions} />}
                    </div>
                </details>
            </div>
        );
    }

    if (item.status === 'error') {
        return (
            <div className="flex flex-col gap-3 p-4 bg-red-50 rounded-lg border border-red-200 text-red-800">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-semibold">Design Update Failed</p>
                        <p className="text-xs mt-1">{item.errorMessage}</p>
                    </div>
                    <button onClick={() => onRemove(item.id)} className="p-1.5 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 transition-colors" aria-label="Remove item">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-4 bg-white rounded-lg border border-slate-200">
            <div className="flex gap-4 w-full">
                <button
                    type="button"
                    onClick={() => item.image && onZoom(item.image)}
                    className="w-24 h-24 md:w-32 md:h-32 shrink-0 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md transition-transform hover:scale-105"
                    aria-label="Enlarge cake image"
                >
                    <LazyImage src={item.image!} alt="Cake Design" className="w-full h-full object-cover rounded-md" />
                </button>
                <div className="grow">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="font-semibold text-slate-800">{item.size}</h2>
                            <p className="text-lg font-bold text-purple-600 mt-1">₱{item.totalPrice.toLocaleString()}</p>
                        </div>
                        <button onClick={() => onRemove(item.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors" aria-label="Remove item">
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
            <details className="w-full">
                <summary className="text-xs font-semibold text-slate-600 cursor-pointer">View Customization Details</summary>
                <div className="mt-2 pl-2 border-l-2 border-slate-200 space-y-1.5 text-xs text-slate-500">
                    <DetailItem label="Type" value={`${item.type}, ${item.thickness}, ${item.size}`} />
                    {item.details.flavors.length === 1 ? (
                        <DetailItem label="Flavor" value={item.details.flavors[0]} />
                    ) : (
                        item.details.flavors.map((flavor, idx) => (
                            <DetailItem key={idx} label={`${tierLabels[idx]} Flavor`} value={flavor} />
                        ))
                    )}
                    {item.details.mainToppers.length > 0 && <DetailItem label="Main Toppers" value={item.details.mainToppers.map(t => t.description).join(', ')} />}
                    {item.details.supportElements.length > 0 && <DetailItem label="Support" value={item.details.supportElements.map(s => s.description).join(', ')} />}
                    {item.details.cakeMessages.map((msg, idx) => (
                        <DetailItem key={idx} label={`Message #${idx + 1}`} value={`'${msg.text}' (${msg.color})`} />
                    ))}
                    {item.details.icingDesign.drip && <DetailItem label="Icing" value="Has Drip Effect" />}
                    {item.details.icingDesign.gumpasteBaseBoard && <DetailItem label="Icing" value="Gumpaste Base Board" />}
                    {Object.entries(item.details.icingDesign.colors).map(([loc, color]) => (
                        <DetailItem key={loc} label={`${colorLabelMap[loc] || loc.charAt(0).toUpperCase() + loc.slice(1)} Color`} value={color} />
                    ))}
                    {item.details.additionalInstructions && <DetailItem label="Instructions" value={item.details.additionalInstructions} />}
                </div>
            </details>
        </div>
    );
};

export default React.memo(CartItemCard);