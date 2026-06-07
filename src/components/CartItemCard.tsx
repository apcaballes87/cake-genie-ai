'use client';
import React from 'react';
import { CartItem, DiscountValidationResult } from '@/types';
import DetailItem from './UI/DetailItem';
import { LoadingSpinner } from './LoadingSpinner';
import { TrashIcon } from './icons';
import LazyImage from './LazyImage';

// Helper to render color values with inline swatches
// Handles both pure hex codes (#FF69B4) and text with embedded hex codes
const renderColorValue = (value: string): React.ReactNode => {
    // Regex to match hex color codes (3 or 6 characters)
    const hexPattern = /#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})\b/g;

    // Check if the value is ONLY a hex code (e.g., "#FF69B4")
    const trimmedValue = value.trim();
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/i.test(trimmedValue)) {
        return (
            <div className="flex items-center justify-end gap-2">
                <div
                    className="w-4 h-4 rounded-md border border-slate-200 shadow-sm shrink-0"
                    style={{ backgroundColor: trimmedValue }}
                    title={trimmedValue}
                />
            </div>
        );
    }

    // Otherwise, parse the text and replace hex codes with inline swatches
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let keyIndex = 0;

    while ((match = hexPattern.exec(value)) !== null) {
        // Add text before the hex code
        if (match.index > lastIndex) {
            parts.push(<span key={`text-${keyIndex}`}>{value.slice(lastIndex, match.index)}</span>);
        }

        // Add the color swatch
        const hexColor = match[0];
        parts.push(
            <span key={`color-${keyIndex}`} className="inline-flex items-center gap-1">
                <span
                    className="inline-block w-3 h-3 rounded border border-slate-300 shadow-sm align-middle"
                    style={{ backgroundColor: hexColor }}
                    title={hexColor}
                />
            </span>
        );

        lastIndex = match.index + match[0].length;
        keyIndex++;
    }

    // Add remaining text after the last match
    if (lastIndex < value.length) {
        parts.push(<span key={`text-end`}>{value.slice(lastIndex)}</span>);
    }

    // If no hex codes found, return the original value
    if (parts.length === 0) {
        return value;
    }

    return <span className="inline-flex flex-wrap items-center gap-0.5">{parts}</span>;
};

interface CartItemCardProps {
    item: CartItem;
    onRemove: (id: string) => void;
    onZoom: (image: string) => void;
    appliedDiscount?: DiscountValidationResult | null;
    subtotal?: number;
}

const CartItemCard: React.FC<CartItemCardProps> = ({ item, onRemove, onZoom, appliedDiscount, subtotal }) => {
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

    const isPercentageDiscount = appliedDiscount?.discountType === 'percentage';
    const discountPercentage = appliedDiscount?.discountValue || 0;
    const discountedPrice = isPercentageDiscount
        ? Math.round(item.totalPrice * (1 - discountPercentage / 100))
        : item.totalPrice;

    if (item.status === 'pending') {
        return (
            <div className="flex flex-col gap-4 p-4 genie-card rounded-lg">
                <div className="flex gap-4 w-full">
                    <div className="relative w-24 h-24 md:w-32 md:h-32 shrink-0 rounded-md bg-slate-100 overflow-hidden">
                        <LazyImage
                            src={item.image!}
                            alt="Original cake design"
                            fill
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
                                {isPercentageDiscount ? (
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-lg text-slate-400 line-through">₱{item.totalPrice.toLocaleString()}</span>
                                        <span className="text-lg font-bold text-purple-600">₱{discountedPrice.toLocaleString()}</span>
                                        <span className="text-xs font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">-{discountPercentage}%</span>
                                    </div>
                                ) : (
                                    <p className="text-lg font-bold text-purple-600 mt-1">₱{item.totalPrice.toLocaleString()}</p>
                                )}
                            </div>
                            <button onClick={() => onRemove(item.id)} className="p-2 genie-icon-button rounded-full transition-colors" aria-label="Remove item">
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
                <details className="w-full">
                    <summary className="text-xs font-semibold text-slate-600 cursor-pointer">View Customization Details</summary>
                    <div className="mt-2 pl-2 border-l-2 border-purple-100 space-y-1.5 text-xs text-slate-500">
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
                                        <span>&quot;{msg.text}&quot;</span>
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
                                value={renderColorValue(color)}
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
                    <button onClick={() => onRemove(item.id)} className="p-1.5 rounded-full hover:bg-red-100 transition-colors" aria-label="Remove item">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-4 genie-card rounded-lg">
            <div className="flex gap-4 w-full">
                <button
                    type="button"
                    onClick={() => item.image && onZoom(item.image)}
                    className="relative w-24 h-24 md:w-32 md:h-32 shrink-0 genie-focus rounded-md transition-transform hover:scale-105"
                    aria-label="Enlarge cake image"
                >
                    <LazyImage src={item.image!} alt="Cake Design" fill className="w-full h-full object-cover rounded-md" />
                </button>
                <div className="grow">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="font-semibold text-slate-800">{item.size}</h2>
                            {isPercentageDiscount ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-lg text-slate-400 line-through">₱{item.totalPrice.toLocaleString()}</span>
                                    <span className="text-lg font-bold text-purple-600">₱{discountedPrice.toLocaleString()}</span>
                                    <span className="text-xs font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">-{discountPercentage}%</span>
                                </div>
                            ) : (
                                <p className="text-lg font-bold text-purple-600 mt-1">₱{item.totalPrice.toLocaleString()}</p>
                            )}
                        </div>
                        <button onClick={() => onRemove(item.id)} className="p-2 genie-icon-button rounded-full transition-colors" aria-label="Remove item">
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
            <details className="w-full">
                <summary className="text-xs font-semibold text-slate-600 cursor-pointer">View Customization Details</summary>
                <div className="mt-2 pl-2 border-l-2 border-purple-100 space-y-1.5 text-xs text-slate-500">
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
                                    <span>&quot;{msg.text}&quot;</span>
                                    <div
                                        className="w-4 h-4 rounded-md border border-slate-200 shadow-sm"
                                        style={{ backgroundColor: msg.color }}
                                        title={msg.color}
                                    />
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
                            value={renderColorValue(color)}
                        />
                    ))}
                    {item.details.additionalInstructions && <DetailItem label="Instructions" value={item.details.additionalInstructions} />}
                </div>
            </details>
        </div>
    );
};

export default React.memo(CartItemCard);
