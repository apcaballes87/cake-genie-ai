'use client';

import { useEffect } from 'react';

/**
 * Tracks the very first page a user lands on in a session.
 * Used to conditionally show the newsletter popup or the discount bubble.
 */
export default function EntryTracker() {
  useEffect(() => {
    // We use sessionStorage so tracking resets when the tab is closed.
    // This allows the user to see the popup again in a fresh session.
    const hasEntry = sessionStorage.getItem('genieph_first_entry');

    if (!hasEntry) {
      // Record only the first entry in this session
      sessionStorage.setItem('genieph_first_entry', window.location.pathname);
      console.log('🏁 Recorded first entry:', window.location.pathname);
    }
  }, []);

  return null;
}
