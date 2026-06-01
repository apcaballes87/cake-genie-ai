'use client';
import React from 'react';
import { COLORS } from '@/constants';

interface ColorPaletteProps {
    selectedColor: string;
    onColorChange: (color: string) => void;
    disabled?: boolean;
}

export const ColorPalette: React.FC<ColorPaletteProps> = React.memo(({ selectedColor, onColorChange, disabled = false }) => {
    const ringClass = 'ring-2 ring-offset-2 ring-offset-purple-50';

    return (
        <div className={`flex flex-wrap gap-1.5 justify-center ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {COLORS.map((color) => (
                <button
                    key={color.name}
                    type="button"
                    onClick={() => onColorChange(color.hex)}
                    className={`rounded-full transition-transform transform hover:scale-110 focus:outline-none w-6 h-6 ${selectedColor.toLowerCase() === color.hex.toLowerCase()
                        ? `ring-purple-400 ${ringClass}`
                        : 'ring-2 ring-transparent'
                        }`}
                    style={{ backgroundColor: color.hex }}
                    aria-label={`Select ${color.name} color`}
                    title={color.name}
                    disabled={disabled}
                >
                    {color.hex.toLowerCase() === '#ffffff' && (
                        <span className="block w-full h-full rounded-full border border-slate-300"></span>
                    )}
                </button>
            ))}
        </div>
    );
});
ColorPalette.displayName = 'ColorPalette';
