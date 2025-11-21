import React, { useState } from 'react';
import { ColorPalette } from './ColorPalette';
import { PencilIcon } from './icons';

interface MultiColorEditorProps {
  colors: (string | null)[];
  onColorChange: (index: number, newHex: string) => void;
}

export const MultiColorEditor: React.FC<MultiColorEditorProps> = ({ colors, onColorChange }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-2">Palette Colors</label>
      {editingIndex !== null ? (
        <div className="animate-fade-in-fast">
          <ColorPalette
            selectedColor={colors[editingIndex] || ''}
            onColorChange={(newHex) => {
              onColorChange(editingIndex, newHex);
              setEditingIndex(null);
            }}
          />
        </div>
      ) : (
        <div className="flex items-center gap-4 flex-wrap">
          {colors.map((color, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full border border-slate-300" style={{ backgroundColor: color || '#FFFFFF' }}></div>
              <button
                type="button"
                onClick={() => setEditingIndex(index)}
                className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800 p-1 rounded-md hover:bg-purple-50"
              >
                <PencilIcon className="w-3 h-3" />
                Edit
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};