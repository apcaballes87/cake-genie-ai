import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
        colors: { side: '#ffffff', top: '#ffffff' },
        border_top: false,
        border_base: false,
        drip: false,
        gumpasteBaseBoard: false,
    },
};

describe('CustomizingPostAnalysisContent', () => {
    it('renders about, specifications, and FAQ content', () => {
        const onUploadAnother = vi.fn();

        render(
            <CustomizingPostAnalysisContent
                analysisResult={analysisResult}
                keywords="Mermaid"
                availability="same-day"
                tags={['under the sea', 'girls birthday']}
                seoDescription="Pastel mermaid cake with shell topper details."
                altText="Pastel mermaid cake with shell topper details"
                basePriceOptions={[{ size: '6" Round', price: 1200 }]}
                onUploadAnother={onUploadAnother}
            />
        );

        const uploadButton = screen.getByRole('button', { name: 'Upload Any Design - Get Instant Pricing' });
        expect(uploadButton).toBeInTheDocument();
        fireEvent.click(uploadButton);
        expect(onUploadAnother).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Any Cake Image')).toBeInTheDocument();
        expect(screen.getByText('Instant AI Pricing')).toBeInTheDocument();
        expect(screen.getByText('Same-day Delivery')).toBeInTheDocument();
        expect(screen.getByText('About This Mermaid Cake')).toBeInTheDocument();
        expect(screen.getByText('Pastel mermaid cake with shell topper details.')).toBeInTheDocument();
        expect(screen.getByText('Design Specifications')).toBeInTheDocument();
        expect(screen.getByText('1 Tier Mermaid')).toBeInTheDocument();
        expect(screen.getByText('Shell topper')).toBeInTheDocument();
        expect(screen.getByText('Pearls')).toBeInTheDocument();
        expect(screen.getByText('under the sea,')).toBeInTheDocument();
        expect(screen.getByText('girls birthday')).toBeInTheDocument();
        expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
        expect(screen.getByText('How much does this Mermaid cake cost?')).toBeInTheDocument();
    });

    it('fills in generated description content when explicit SEO copy is absent', () => {
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
                seoDescription=""
                altText=""
                basePriceOptions={[{ size: '6" Round', price: 900 }]}
                onUploadAnother={vi.fn()}
            />
        );

        expect(screen.getByText('About This Minimalist Cake')).toBeInTheDocument();
        expect(screen.queryByText('Primary Features')).not.toBeInTheDocument();
        expect(screen.queryByText('Decorations')).not.toBeInTheDocument();
        expect(screen.queryByText('Tags')).not.toBeInTheDocument();
        expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
    });
});
