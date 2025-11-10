import React from 'react';
import { COLORS } from '../constants';

interface ColorPaletteProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
}

export const ColorPalette: React.FC<ColorPaletteProps> = React.memo(({ selectedColor, onColorChange }) => {
  const ringClass = 'ring-2 ring-offset-2 ring-offset-slate-50';

  return (
    <div className={`flex flex-wrap gap-2`}>
      {COLORS.map((color) => (
        <button
          key={color.name}
          type="button"
          onClick={() => onColorChange(color.hex)}
          className={`rounded-full transition-transform transform hover:scale-110 focus:outline-none w-8 h-8 ${
            selectedColor.toLowerCase() === color.hex.toLowerCase()
              ? `ring-purple-500 ${ringClass}`
              : 'ring-2 ring-transparent'
          }`}
          style={{ backgroundColor: color.hex }}
          aria-label={`Select ${color.name} color`}
          title={color.name}
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
