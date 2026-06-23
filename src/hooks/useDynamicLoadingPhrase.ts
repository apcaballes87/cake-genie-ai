'use client';

import { useState, useEffect } from 'react';

const ANALYSIS_PHRASES: string[] = [
    "Analyzing design elements & pricing...",
    "Checking image quality and alignment...",
    "Detecting cake size and shape...",
    "Determining number of tiers...",
    "Measuring cake height and thickness...",
    "Identifying primary icing base design...",
    "Analyzing icing colors and color type...",
    "Extracting gumpaste base board details...",
    "Scanning for main toppers and character printouts...",
    "Locating gumpaste and acrylic decorations...",
    "Analyzing edible photo placements...",
    "Checking for support toppers and toy elements...",
    "Identifying flower decorations and candles...",
    "Detecting sprinkle patterns and piping styles...",
    "Reading cake messages and custom text plaques...",
    "Evaluating color codes and palette harmony...",
    "Determining complexity tier and labor requirements...",
    "Finalizing cake details and preparing custom workspace..."
];

export interface UseDynamicLoadingPhraseResult {
    phrase: string;
    isVisible: boolean;
}

export const useDynamicLoadingPhrase = (isActive: boolean, intervalMs: number = 3000): UseDynamicLoadingPhraseResult => {
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [isVisible, setIsVisible] = useState<boolean>(true);
    const [visiblePhrase, setVisiblePhrase] = useState<string>(ANALYSIS_PHRASES[0]);

    useEffect(() => {
        if (!isActive) {
            setCurrentIndex(0);
            setVisiblePhrase(ANALYSIS_PHRASES[0]);
            setIsVisible(true);
            return;
        }

        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const interval = setInterval(() => {
            setIsVisible(false);

            timeoutId = setTimeout(() => {
                setCurrentIndex((prevIndex) => {
                    const nextIndex = (prevIndex + 1) % ANALYSIS_PHRASES.length;
                    setVisiblePhrase(ANALYSIS_PHRASES[nextIndex]);
                    return nextIndex;
                });
                setIsVisible(true);
            }, 300);
        }, intervalMs);

        return () => {
            clearInterval(interval);
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [isActive, intervalMs]);

    return { phrase: visiblePhrase, isVisible };
};
