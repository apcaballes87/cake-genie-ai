import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HybridAnalysisResult } from '@/types';
import { CustomizingPostAnalysisContent } from './CustomizingPostAnalysisContent';

const analysisResult: HybridAnalysisResult = {
    cakeType: '1 Tier',
    cakeThickness: '4 in',
    main_toppers: [{
        type: 'figurine',
        description: 'Shell topper',
        size: 'medium',
        quantity: 1,
        group_id: 'topper-1',
        classification: 'hero',
    }],
    support_elements: [{
        type: 'sprinkles',
        description: 'Pearls',
        size: 'small',
        group_id: 'support-1',
    }],
    cake_messages: [],
    icing_design: {
        base: 'soft_icing',
        color_type: 'single',
        colors: { top: '#ffffff', side: '#ffffff' },
        border_top: false,
        border_base: false,
        drip: false,
        gumpasteBaseBoard: false,
    },
};

describe('CustomizingPostAnalysisContent', () => {
    it('renders about, specifications, and FAQ content', () => {
        render(
            <CustomizingPostAnalysisContent
                analysisResult={analysisResult}
                keywords="Mermaid"
                availability="same-day"
                tags={['under the sea', 'girls birthday']}
                aboutDescription="Pastel mermaid cake with shell topper details."
                basePriceOptions={[{ size: '6" Round', price: 1200 }]}
            />
        );

        expect(screen.getByText('About This Mermaid Cake')).toBeInTheDocument();
        expect(screen.getByText('Pastel mermaid cake with shell topper details.')).toBeInTheDocument();
        expect(screen.getByText('Design Specifications')).toBeInTheDocument();
        expect(screen.getByText('1 Tier Mermaid')).toBeInTheDocument();
        expect(screen.getByText('Shell topper')).toBeInTheDocument();
        expect(screen.getByText('Pearls')).toBeInTheDocument();
        expect(screen.getByText('under the sea, girls birthday')).toBeInTheDocument();
        expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
        expect(screen.getByText('How much does this Mermaid cake cost?')).toBeInTheDocument();
    });

    it('omits optional description and empty rows when data is absent', () => {
        render(
            <CustomizingPostAnalysisContent
                analysisResult={{
                    ...analysisResult,
                    main_toppers: [],
                    support_elements: [],
                }}
                keywords="Minimalist"
                availability="normal"
                tags={[]}
                aboutDescription=""
                basePriceOptions={[{ size: '6" Round', price: 900 }]}
            />
        );

        expect(screen.queryByText('About This Minimalist Cake')).not.toBeInTheDocument();
        expect(screen.queryByText('Primary Features')).not.toBeInTheDocument();
        expect(screen.queryByText('Decorations')).not.toBeInTheDocument();
        expect(screen.queryByText('Tags')).not.toBeInTheDocument();
        expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
    });
});