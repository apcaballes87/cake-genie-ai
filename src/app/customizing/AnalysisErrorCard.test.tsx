import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnalysisErrorCard } from './AnalysisErrorCard';

describe('AnalysisErrorCard', () => {
    it('hides provider details and offers gallery and search actions during an AI outage', () => {
        const onBrowseGallery = vi.fn();
        const onSearchDesigns = vi.fn();

        render(
            <AnalysisErrorCard
                analysisError="AI cake analysis is not authorized. Please check the Vertex AI and Workload Identity configuration."
                onBrowseGallery={onBrowseGallery}
                onSearchDesigns={onSearchDesigns}
            />
        );

        expect(screen.getByRole('heading', { name: 'Our AI service is temporarily offline' })).toBeInTheDocument();
        expect(screen.queryByText(/Vertex AI/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Workload Identity/i)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Browse 10,000+ Cake Designs' }));
        fireEvent.click(screen.getByRole('button', { name: 'Search Cake Designs' }));

        expect(onBrowseGallery).toHaveBeenCalledOnce();
        expect(onSearchDesigns).toHaveBeenCalledOnce();
    });

    it('keeps upload guidance for image rejection errors', () => {
        render(
            <AnalysisErrorCard
                analysisError="AI_REJECTION: Please upload a single cake image."
            />
        );

        expect(screen.getByRole('heading', { name: 'Analysis Error' })).toBeInTheDocument();
        expect(screen.getByText('Please upload a single cake image.')).toBeInTheDocument();
        expect(screen.getByText('Tips for better results:')).toBeInTheDocument();
    });
});
