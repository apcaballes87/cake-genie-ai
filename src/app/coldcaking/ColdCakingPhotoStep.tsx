'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';

interface ColdCakingPhotoStepProps {
    onUploadClick: () => void;
    hasPhoto: boolean;
    onDeletePhoto?: () => void;
}
export function ColdCakingPhotoStep({ onUploadClick, hasPhoto, onDeletePhoto }: ColdCakingPhotoStepProps) {
    if (hasPhoto) {
        return (
            <div className="flex flex-row items-center justify-center gap-2 py-1">
                <div className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-green-50 border border-green-200">
                    <span className="text-green-500 text-sm">✓</span>
                    <span className="text-[11px] font-semibold text-green-700">Photo uploaded</span>
                </div>
                <button
                    onClick={onUploadClick}
                    className="text-[10px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-all py-2 px-5 rounded-full shadow-sm border border-purple-100 flex items-center gap-1.5"
                >
                    <span className="text-base leading-none">↑</span> Change photo
                </button>
                {onDeletePhoto && (
                    <button
                        onClick={onDeletePhoto}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete photo"
                        aria-label="Delete photo"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex justify-center py-2">
            <button
                onClick={onUploadClick}
                className="text-[10px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-all py-2 px-5 rounded-full shadow-sm border border-purple-100 flex items-center gap-1.5"
            >
                <span className="text-base leading-none">+</span> Upload photo
            </button>
        </div>
    );
}
