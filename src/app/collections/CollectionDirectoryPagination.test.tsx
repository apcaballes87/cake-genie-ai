import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CollectionDirectoryPagination } from './CollectionDirectoryPagination';
import {
  buildCollectionDirectoryHref,
  buildCollectionDirectoryPath,
  getCollectionDirectoryPageNumbers,
} from './pagination';

describe('collection directory pagination', () => {
  it('uses the clean directory URL for page one and query URLs thereafter', () => {
    expect(buildCollectionDirectoryPath(1)).toBe('/collections');
    expect(buildCollectionDirectoryPath(2)).toBe('/collections?page=2');
    expect(buildCollectionDirectoryHref(1)).toBe('/collections#categories-section');
    expect(buildCollectionDirectoryHref(8)).toBe('/collections?page=8#categories-section');
  });

  it('keeps the current-page neighborhood compact', () => {
    expect(getCollectionDirectoryPageNumbers(5, 10)).toEqual([
      1,
      'ellipsis',
      3,
      4,
      5,
      6,
      7,
      'ellipsis',
      10,
    ]);
  });

  it('server-renders crawlable previous, numbered, and next anchors', () => {
    const markup = renderToStaticMarkup(
      <CollectionDirectoryPagination currentPage={2} totalPages={8} />,
    );

    expect(markup).toContain('href="/collections#categories-section"');
    expect(markup).toContain('href="/collections?page=3#categories-section"');
    expect(markup).toContain('href="/collections?page=8#categories-section"');
    expect(markup).toContain('rel="prev"');
    expect(markup).toContain('rel="next"');
    expect(markup).not.toContain('<button');
  });
});
