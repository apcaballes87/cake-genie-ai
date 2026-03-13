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

  it('sanitizes malicious HTML to prevent XSS', () => {
    const maliciousContent = 'Some text <script>alert("xss")</script> and an image <img src="x" onerror="alert(\'xss\')">';
    const { container } = render(<BlogContent content={maliciousContent} />);

    // Check that script tag is removed
    expect(container.querySelector('script')).toBeNull();

    // Check that onerror attribute is removed from img
    const img = container.querySelector('img');
    if (img) {
      expect(img).not.toHaveAttribute('onerror');
    }
  });
});