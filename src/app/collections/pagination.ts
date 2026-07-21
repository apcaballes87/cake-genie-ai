export const COLLECTIONS_PER_PAGE = 30;

export function getCollectionDirectoryPageNumbers(
  currentPage: number,
  totalPages: number,
): Array<number | 'ellipsis'> {
  const pages: Array<number | 'ellipsis'> = [];
  const range = 2;

  for (let page = 1; page <= totalPages; page += 1) {
    if (
      page === 1
      || page === totalPages
      || (page >= currentPage - range && page <= currentPage + range)
    ) {
      pages.push(page);
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis');
    }
  }

  return pages;
}

export function buildCollectionDirectoryPath(page: number): string {
  return page <= 1 ? '/collections' : `/collections?page=${page}`;
}

export function buildCollectionDirectoryHref(page: number): string {
  return `${buildCollectionDirectoryPath(page)}#categories-section`;
}
