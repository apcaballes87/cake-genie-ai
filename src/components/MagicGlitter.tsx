'use client';

import React, { useMemo } from 'react';

/**
 * MagicGlitter component creates a premium "magic" overlay with shimmering sparkles.
 * Used during AI design updates to provide a high-end, themed loading experience.
 */
const MagicGlitter = () => {
    // Generate a set of random sparkles to avoid re-rendering them
    const sparkles = useMemo(() => {
        return Array.from({ length: 120 }).map((_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            size: Math.random() * 14 + 4, // 4px to 18px
            delay: `${Math.random() * 4}s`,
            duration: `${1.5 + Math.random() * 2.5}s`,
            type: Math.random() > 0.7 ? 'star' : 'circle',
            color: [
                '#a855f7', // var(--genie-primary)
                '#ec4899', // var(--genie-accent)
                '#fbbf24', // Gold
                '#ffffff', // White
                '#818cf8', // Indigo
                '#60a5fa', // Blue
            ][Math.floor(Math.random() * 6)],
        }));
    }, []);

    return (
        <div 
            className="absolute inset-0 pointer-events-none overflow-hidden z-30"
            aria-hidden="true"
        >
            {sparkles.map((sparkle) => (
                <div
                    key={sparkle.id}
                    className="absolute animate-sparkle"
                    style={{
                        left: sparkle.left,
                        top: sparkle.top,
                        width: `${sparkle.size}px`,
                        height: `${sparkle.size}px`,
                        backgroundColor: sparkle.type === 'circle' ? sparkle.color : 'transparent',
                        borderRadius: sparkle.type === 'circle' ? '50%' : '0',
                        clipPath: sparkle.type === 'star' ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' : 'none',
                        background: sparkle.type === 'star' ? sparkle.color : undefined,
                        filter: 'blur(0.25px) drop-shadow(0 0 6px currentColor)',
                        color: sparkle.color,
                        animationDelay: sparkle.delay,
                        animationDuration: sparkle.duration,
                    }}
                />
            ))}

            
            {/* Shimmering magic beams */}
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_3s_infinite] mix-blend-overlay" />
            
            {/* Soft magical glow layers */}
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 via-transparent to-pink-500/20 mix-blend-overlay animate-pulse" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/30 via-transparent to-transparent opacity-40" />
        </div>
    );
};


export default MagicGlitter;
