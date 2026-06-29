import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlogContent } from './BlogContent';

describe('BlogContent', () => {
  it('keeps internal Genie.ph links as normal internal anchors', () => {
    render(
      <BlogContent content="See our [birthday cakes](https://genie.ph/collections/birthday) and [minimalist designs](/collections/minimalist)." />,
    );

    expect(screen.getByRole('link', { name: 'birthday cakes' })).toHaveAttribute(
      'href',
      '/collections/birthday',
    );
    expect(screen.getByRole('link', { name: 'birthday cakes' })).not.toHaveAttribute('target');
    expect(screen.getByRole('link', { name: 'minimalist designs' })).toHaveAttribute(
      'href',
      '/collections/minimalist',
    );
  });

  it('keeps external links opening in a new tab', () => {
    render(<BlogContent content="Read [this guide](https://example.com/guide)." />);

    expect(screen.getByRole('link', { name: 'this guide' })).toHaveAttribute(
      'target',
      '_blank',
    );
  });

  it('adds stable dimensions to raw article images', () => {
    render(
      <BlogContent content='<img src="https://example.com/party.jpg" alt="Party package" class="w-full h-auto" />' />,
    );

    const image = screen.getByRole('img', { name: 'Party package' });

    expect(image).toHaveAttribute('width', '800');
    expect(image).toHaveAttribute('height', '450');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
  });

  it('keeps explicit image dimensions when article content already provides them', () => {
    render(
      <BlogContent content='<img src="https://example.com/tall.jpg" alt="Tall cake" width="600" height="900" />' />,
    );

    const image = screen.getByRole('img', { name: 'Tall cake' });

    expect(image).toHaveAttribute('width', '600');
    expect(image).toHaveAttribute('height', '900');
  });

  it('uses known dimensions for party-package images that appear in raw blog HTML', () => {
    render(
      <BlogContent content='<img src="https://example.com/blogs/jollibee-vs-mcdonalds-kids-party-packages-2026/jolibeeparty2026.jpg" alt="Jollibee Party Package" />' />,
    );

    const image = screen.getByRole('img', { name: 'Jollibee Party Package' });

    expect(image).toHaveAttribute('width', '735');
    expect(image).toHaveAttribute('height', '490');
  });
});
