'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCakeCustomization } from '@/contexts/CustomizationContext';
import { CAKE_TYPE_THUMBNAILS } from '@/constants';
import type { CakeType, CakeThickness, CakeFlavor } from '@/types';

const DEFAULT_THICKNESS: CakeThickness = '3 in';
const DEFAULT_FLAVOR: CakeFlavor = 'Chocolate Cake';

interface SizeOption {
    label: string;
    sublabel: string;
    type: CakeType;
    size: string;
}

const SIZES: SizeOption[] = [
    { label: 'Bento', sublabel: '4" Round', type: 'Bento', size: '4" Round' },
    { label: '6" Round', sublabel: '3 in height', type: '1 Tier', size: '6" Round' },
    { label: '8" Round', sublabel: '3 in height', type: '1 Tier', size: '8" Round' },
    { label: '8×8', sublabel: 'Square', type: 'Square', size: '8" Square' },
    { label: '8×12', sublabel: 'Rectangle', type: 'Rectangle', size: '8"x12"' },
    { label: '10×14', sublabel: 'Rectangle', type: 'Rectangle', size: '10"x14"' },
    { label: '12×16', sublabel: 'Rectangle', type: 'Rectangle', size: '12"x16"' },
];

const DEFAULT_INDEX = 1; // 6" Round

export function ColdCakingCakePicker() {
    const { handleCakeInfoChange, cakeInfo } = useCakeCustomization();
    const [selectedIndex, setSelectedIndex] = useState(DEFAULT_INDEX);
    const hasSetDefault = useRef(false);

    // Set default selection (6" Round) on mount
    useEffect(() => {
        if (hasSetDefault.current) return;
        hasSetDefault.current = true;
        const def = SIZES[DEFAULT_INDEX];
        handleCakeInfoChange({
            type: def.type,
            size: def.size,
            thickness: DEFAULT_THICKNESS,
            flavors: [DEFAULT_FLAVOR],
        });
    }, [handleCakeInfoChange]);

    const handleSelect = (index: number) => {
        setSelectedIndex(index);
        const option = SIZES[index];
        handleCakeInfoChange({
            type: option.type,
            size: option.size,
            thickness: DEFAULT_THICKNESS,
            flavors: cakeInfo?.flavors?.length ? cakeInfo.flavors : [DEFAULT_FLAVOR],
        });
    };

    return (
        <div className="w-full max-w-7xl mx-auto px-4 mb-2">
            <div className="bg-white/70 backdrop-blur-lg p-3 rounded-2xl shadow-lg border border-slate-200">
                <h3 className="text-[13px] font-semibold text-slate-800 mb-2.5 px-1">
                    Step 1: Choose Your Cake Size
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {SIZES.map((option, index) => {
                        const isSelected = index === selectedIndex;
                        return (
                            <button
                                key={option.label}
                                onClick={() => handleSelect(index)}
                                className="group flex flex-col items-center gap-1 shrink-0 min-w-[60px]"
                            >
                                <div className={`w-14 h-14 rounded-xl border-2 overflow-hidden relative transition-all ${
                                    isSelected
                                        ? 'border-purple-500 ring-2 ring-purple-200 bg-purple-50'
                                        : 'border-slate-200 group-hover:border-purple-400 bg-white'
                                }`}>
                                    <img
                                        src={CAKE_TYPE_THUMBNAILS[option.type]}
                                        alt={option.label}
                                        className="absolute inset-0 w-full h-full object-contain"
                                    />
                                </div>
                                <span className={`text-[10px] text-center font-semibold leading-tight mt-0.5 ${
                                    isSelected ? 'text-purple-700' : 'text-slate-600'
                                }`}>
                                    {option.label}
                                </span>
                                <span className="text-[9px] text-center text-slate-400 leading-tight">
                                    {option.sublabel}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
