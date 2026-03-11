import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    CustomizingPageMetaHeader,
    CustomizingSupplementalContent,
} from './CustomizingPageMetaSections';

describe('CustomizingPageMetaSections', () => {
    it('renders shop breadcrumbs and product title metadata', () => {
        render(
            <CustomizingPageMetaHeader
                product={{
                    product_id: 'product-1', merchant_id: 'merchant-1', p_hash: 'hash-1', title: 'Floral Cake',
                    slug: 'floral-cake', short_description: null, long_description: null, image_url: null,
                    alt_text: null, image_caption: null, meta_keywords: null, og_title: null, og_description: null,
                    brand: null, sku: null, gtin: null, tags: ['floral'], category: 'Birthday', cake_type: null,
                    custom_price: null, availability: 'in_stock', is_featured: false, is_active: true, sort_order: 0,
                    created_at: '2025-01-01', updated_at: '2025-01-01',
                }}
                merchant={{
                    merchant_id: 'merchant-1', user_id: null, business_name: 'Sweet Crumbs', slug: 'sweet-crumbs',
                    description: null, cover_image_url: null, profile_image_url: null, address: null, city: null,
                    latitude: null, longitude: null, phone: null, email: null, facebook_url: null,
                    instagram_url: null, rating: 5, review_count: 10, is_verified: true, is_active: true,
                    min_order_lead_days: 1, delivery_fee: 0, created_at: '2025-01-01', updated_at: '2025-01-01',
                }}
            />
        );

        expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/shop');
        expect(screen.getByRole('link', { name: 'Sweet Crumbs' })).toHaveAttribute('href', '/shop/sweet-crumbs');
        expect(screen.getByRole('heading', { name: 'Floral Cake' })).toBeInTheDocument();
        expect(screen.getByText('Birthday')).toBeInTheDocument();
    });

    it('renders recent-search breadcrumb title and supplemental fallback content', () => {
        render(
            <>
                <CustomizingPageMetaHeader
                    recentSearchDesign={{
                        slug: 'pink-bento',
                        seo_title: 'Pink Bento Cake | Genie.ph',
                        keywords: 'Pink Bento Cake',
                    }}
                />
                <CustomizingSupplementalContent
                    showClientFallback
                    product={{
                        product_id: 'product-2', merchant_id: 'merchant-2', p_hash: 'hash-2', title: 'Pink Bento Cake',
                        slug: 'pink-bento-cake', short_description: 'Soft pink minimalist bento cake.',
                        long_description: null, image_url: null, alt_text: null, image_caption: null, meta_keywords: null,
                        og_title: null, og_description: null, brand: null, sku: null, gtin: null,
                        tags: ['pink', 'minimalist'], category: null, cake_type: null, custom_price: null,
                        availability: 'in_stock', is_featured: false, is_active: true, sort_order: 0,
                        created_at: '2025-01-01', updated_at: '2025-01-01',
                    }}
                />
            </>
        );

        expect(screen.getByRole('link', { name: 'Customizing' })).toHaveAttribute('href', '/customizing');
        expect(screen.getByRole('heading', { name: 'Pink Bento Cake' })).toBeInTheDocument();
        expect(screen.getByText('About This Cake')).toBeInTheDocument();
        expect(screen.getByText('Soft pink minimalist bento cake.')).toBeInTheDocument();
        expect(screen.getByText('Related Tags')).toBeInTheDocument();
        expect(screen.getByText('pink')).toBeInTheDocument();
        expect(screen.getByText('minimalist')).toBeInTheDocument();
    });

    it('prefers the SEO content slot over the fallback block', () => {
        render(
            <CustomizingSupplementalContent
                showClientFallback
                seoContentSlot={<div>Server rendered SEO block</div>}
                product={{
                    product_id: 'product-3', merchant_id: 'merchant-3', p_hash: 'hash-3', title: 'Ombre Cake',
                    slug: 'ombre-cake', short_description: 'Should stay hidden', long_description: null, image_url: null,
                    alt_text: null, image_caption: null, meta_keywords: null, og_title: null, og_description: null,
                    brand: null, sku: null, gtin: null, tags: ['ombre'], category: null, cake_type: null,
                    custom_price: null, availability: 'in_stock', is_featured: false, is_active: true, sort_order: 0,
                    created_at: '2025-01-01', updated_at: '2025-01-01',
                }}
            />
        );

        expect(screen.getByText('Server rendered SEO block')).toBeInTheDocument();
        expect(screen.queryByText('About This Cake')).not.toBeInTheDocument();
        expect(screen.queryByText('Should stay hidden')).not.toBeInTheDocument();
    });
});