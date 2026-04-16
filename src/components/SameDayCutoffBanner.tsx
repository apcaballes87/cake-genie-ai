'use client';

import { useEffect, useState } from 'react';

// Same-day delivery cutoff is 4PM Asia/Manila (UTC+8, no DST).
const CUTOFF_HOUR = 16;

function getManilaMinutesOfDay(): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    // Intl may return "24" for midnight hour in some locales — normalize.
    return (h % 24) * 60 + m;
}

type Mode = 'open' | 'urgent' | 'closed';

interface BannerState {
    mode: Mode;
    hoursLeft: number;
    minutesLeft: number;
}

function computeState(): BannerState {
    const nowMins = getManilaMinutesOfDay();
    const cutoffMins = CUTOFF_HOUR * 60;
    const diff = cutoffMins - nowMins;

    if (diff <= 0) {
        return { mode: 'closed', hoursLeft: 0, minutesLeft: 0 };
    }

    const hoursLeft = Math.floor(diff / 60);
    const minutesLeft = diff % 60;
    const mode: Mode = diff <= 60 ? 'urgent' : 'open';
    return { mode, hoursLeft, minutesLeft };
}

/**
 * Live same-day delivery countdown banner text.
 *
 * Renders a static fallback on the server / first client render so the
 * layout doesn't shift, then hydrates into a live countdown that ticks
 * every 30 seconds.
 */
export default function SameDayCutoffBanner() {
    const [state, setState] = useState<BannerState | null>(null);

    useEffect(() => {
        const tick = () => setState(computeState());
        tick();
        const id = setInterval(tick, 30_000);
        return () => clearInterval(id);
    }, []);

    // SSR / pre-hydration fallback — keep copy identical to avoid CLS
    if (!state) {
        return (
            <span className="inline-flex items-center text-white text-[10px] md:text-[11px] font-bold tracking-wider">
                Place your order by 4PM for same-day delivery in Metro Cebu 💖
            </span>
        );
    }

    if (state.mode === 'closed') {
        return (
            <span className="inline-flex items-center text-white text-[10px] md:text-[11px] font-bold tracking-wider">
                Same-day cutoff closed — order now for tomorrow 💖
            </span>
        );
    }

    const { hoursLeft, minutesLeft, mode } = state;
    const timeLeft =
        hoursLeft > 0
            ? `${hoursLeft}h ${minutesLeft}m`
            : `${minutesLeft}m`;

    return (
        <span
            className={`inline-flex items-center text-white text-[10px] md:text-[11px] font-bold tracking-wider ${mode === 'urgent' ? 'animate-pulse' : ''}`}
        >
            {mode === 'urgent' ? '⏰' : '⏱️'} Same-day delivery in Metro Cebu — order in {timeLeft} 💖
        </span>
    );
}
