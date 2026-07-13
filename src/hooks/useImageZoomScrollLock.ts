'use client';

import { useEffect } from 'react';

type ScrollLockSnapshot = {
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  bodyPaddingRight: string;
  bodyOverscrollBehavior: string;
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
  scrollY: number;
};

let activeLocks = 0;
let snapshot: ScrollLockSnapshot | null = null;

function acquireScrollLock() {
  if (typeof window === 'undefined' || !document.body) {
    return;
  }

  if (activeLocks === 0) {
    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - html.clientWidth;

    snapshot = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyPaddingRight: body.style.paddingRight,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
      htmlOverflow: html.style.overflow,
      htmlOverscrollBehavior: html.style.overscrollBehavior,
      scrollY,
    };

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overscrollBehavior = 'none';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.classList.add('genie-image-zoom-open');
  }

  activeLocks += 1;
}

function releaseScrollLock() {
  if (activeLocks === 0) {
    return;
  }

  activeLocks -= 1;
  if (activeLocks > 0 || !snapshot || typeof window === 'undefined' || !document.body) {
    return;
  }

  const body = document.body;
  const html = document.documentElement;
  const previous = snapshot;

  body.style.overflow = previous.bodyOverflow;
  body.style.position = previous.bodyPosition;
  body.style.top = previous.bodyTop;
  body.style.width = previous.bodyWidth;
  body.style.paddingRight = previous.bodyPaddingRight;
  body.style.overscrollBehavior = previous.bodyOverscrollBehavior;
  html.style.overflow = previous.htmlOverflow;
  html.style.overscrollBehavior = previous.htmlOverscrollBehavior;
  body.classList.remove('genie-image-zoom-open');
  snapshot = null;

  if (window.scrollY !== previous.scrollY) {
    window.scrollTo(0, previous.scrollY);
  }
}

/** Locks page scrolling while any image/document zoom overlay is mounted. */
export function useImageZoomScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) {
      return;
    }

    acquireScrollLock();
    return releaseScrollLock;
  }, [isLocked]);
}
