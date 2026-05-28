'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { MessageCircle } from './icons';
import { createClient } from '@/lib/supabase/client';

const ChatModal = dynamic(() => import('./ChatModal'), {
  ssr: false,
});

interface Position {
  x: number;
  y: number;
}

/**
 * Returns true once the viewport is desktop-width AND the user has shown some
 * sign of engagement (mouse move, scroll, key press, or touch). We don't want
 * to mount the chat bubble or fire its Supabase auth lookup on first paint —
 * it's `hidden md:block` so it's never rendered on mobile, but the JS still
 * runs and hits Supabase on every page mount. This hook keeps that work out
 * of the LCP/FCP critical path.
 */
function useDesktopAfterEngagement(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;
    if (!isDesktop()) {
      // Listen for resize in case someone rotates a tablet, but skip the
      // engagement signal so we still don't activate on a phone-sized layout.
      const onResize = () => {
        if (isDesktop()) setReady(true);
      };
      window.addEventListener('resize', onResize, { passive: true });
      return () => window.removeEventListener('resize', onResize);
    }

    const activate = () => setReady(true);
    const events: Array<keyof WindowEventMap> = [
      'pointermove',
      'scroll',
      'keydown',
      'touchstart',
    ];
    events.forEach((evt) =>
      window.addEventListener(evt, activate, { once: true, passive: true })
    );

    // Fallback: activate after 4s of idle so the bubble still appears even
    // if the user is reading without scrolling.
    const idleTimer = window.setTimeout(activate, 4000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, activate));
      window.clearTimeout(idleTimer);
    };
  }, []);

  return ready;
}

export default function FloatingChatBubble() {
  const isReady = useDesktopAfterEngagement();

  // Render nothing (and import nothing else) until we're past the LCP window
  // and on a desktop viewport.
  if (!isReady) return null;

  return <FloatingChatBubbleInner />;
}

function FloatingChatBubbleInner() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 24, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(true);
  const [user, setUser] = useState<{ id: string; email?: string; user_metadata?: { full_name?: string } } | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      setShowTooltip(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTooltip(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    const maxX = window.innerWidth - 64;
    const maxY = window.innerHeight - 64;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setShowTooltip(false);
    }
  };

  return (
    <>
      <div
        ref={bubbleRef}
        className={`fixed hidden md:block z-[110] transition-transform ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          right: position.x,
          bottom: position.y,
        }}
        onMouseDown={handleMouseDown}
      >
        {showTooltip && !isOpen && (
          <div className="absolute bottom-full right-0 mb-3 w-44 p-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg animate-pulse">
            <p>Hi! If you need help, we&apos;re here!</p>
            <div className="absolute bottom-0 right-4 -mb-2 w-3 h-3 bg-slate-800 rotate-45"></div>
          </div>
        )}
        
        <button
          onClick={handleToggle}
          className={`w-14 h-14 rounded-full bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center ${isOpen ? 'rotate-90' : ''}`}
          aria-label={isOpen ? 'Close chat' : 'Open chat'}
        >
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          ) : (
            <MessageCircle className="w-7 h-7" />
          )}
        </button>
      </div>

      {isOpen ? (
        <ChatModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          userId={user?.id}
          userEmail={user?.email}
          userName={user?.user_metadata?.full_name}
        />
      ) : null}
    </>
  );
}
