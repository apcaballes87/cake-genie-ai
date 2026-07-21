import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  buildCollectionDirectoryHref,
  getCollectionDirectoryPageNumbers,
} from './pagination';

type CollectionDirectoryPaginationProps = {
  currentPage: number;
  totalPages: number;
};

export function CollectionDirectoryPagination({
  currentPage,
  totalPages,
}: CollectionDirectoryPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center gap-1" aria-label="Collection directory pages">
      {currentPage > 1 && (
        <Link
          rel="prev"
          href={buildCollectionDirectoryHref(currentPage - 1)}
          className="rounded-full border border-slate-200 p-2 text-slate-600 transition-colors hover:border-purple-200 hover:bg-purple-50"
          aria-label="Previous collection page"
          prefetch={false}
        >
          <ChevronLeft size={18} />
        </Link>
      )}

      {getCollectionDirectoryPageNumbers(currentPage, totalPages).map((page, index) => (
        page === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="px-2 text-sm text-slate-400" aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={page}
            href={buildCollectionDirectoryHref(page)}
            className={`flex h-9 min-w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${
              currentPage === page
                ? 'border-purple-600 bg-purple-600 text-white shadow-md'
                : 'border-slate-200 bg-white text-slate-700 hover:border-purple-200 hover:bg-purple-50'
            }`}
            aria-label={`Collection page ${page}`}
            aria-current={currentPage === page ? 'page' : undefined}
            prefetch={false}
          >
            {page}
          </Link>
        )
      ))}

      {currentPage < totalPages && (
        <Link
          rel="next"
          href={buildCollectionDirectoryHref(currentPage + 1)}
          className="rounded-full border border-slate-200 p-2 text-slate-600 transition-colors hover:border-purple-200 hover:bg-purple-50"
          aria-label="Next collection page"
          prefetch={false}
        >
          <ChevronRight size={18} />
        </Link>
      )}
    </nav>
  );
}
