import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface CustomizationBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    actionButton?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

export const CustomizationBottomSheet: React.FC<CustomizationBottomSheetProps> = ({
    isOpen,
    onClose,
    title,
    children,
    actionButton,
    className = '',
    style
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartY = React.useRef<number>(0);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            // Use setTimeout to ensure the browser paints the initial state before animating
            const timer = setTimeout(() => setIsAnimating(true), 50);
            return () => clearTimeout(timer);
        } else {
            setIsAnimating(false);
            // Wait for animation to finish before hiding
            const timer = setTimeout(() => setIsVisible(false), 500);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
        setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - touchStartY.current;

        // Only allow dragging down
        if (diff > 0) {
            setDragOffset(diff);
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        if (dragOffset > 100) {
            // Threshold to close
            onClose();
        } else {
            // Snap back
            setDragOffset(0);
        }
    };

    // Reset drag offset when closed
    useEffect(() => {
        if (!isOpen) {
            setDragOffset(0);
        }
    }, [isOpen]);

    if (!isVisible) return null;

    return (
        <div
            className={`fixed inset-x-0 z-40 flex justify-center pointer-events-none transition-all duration-500 ease-in-out ${!style?.bottom ? 'bottom-[80px]' : ''}`}
            style={style}
        >
            {/* Sheet */}
            <div
                className={`
                    relative w-full max-w-lg bg-white rounded-t-2xl shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] 
                    flex flex-col max-h-[60vh] pointer-events-auto border-t border-slate-100
                    ${className}
                `}
                style={{
                    transform: isAnimating ? `translateY(${dragOffset}px)` : 'translateY(100%)',
                    transition: isDragging ? 'none' : 'transform 500ms cubic-bezier(0.32, 0.72, 0, 1)',
                }}
            >
                <div
                    className="touch-none"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* Drag Handle Area */}
                    <div className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-100 bg-white sticky top-0 z-10">
                        <h2 className="text-base font-bold text-slate-800">{title}</h2>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 overscroll-contain bg-white">
                    {children}
                </div>

                {/* Footer (Action Button) */}
                {actionButton && (
                    <div className="p-3 border-t border-slate-100 bg-white sticky bottom-0 z-10">
                        {actionButton}
                    </div>
                )}
            </div>
        </div>
    );
};
