import { describe, expect, it } from 'vitest';
import { canConsumeDesktopSidebarWheel, shouldCaptureDesktopSidebarScroll } from './desktopSidebarScroll';

describe('canConsumeDesktopSidebarWheel', () => {
    it('consumes downward wheel input while the sidebar still has space below', () => {
        expect(canConsumeDesktopSidebarWheel({
            deltaY: 120,
            rightScrollMax: 600,
            rightScrollTop: 120,
        })).toBe(true);
    });

    it('consumes upward wheel input while the sidebar still has space above', () => {
        expect(canConsumeDesktopSidebarWheel({
            deltaY: -120,
            rightScrollMax: 600,
            rightScrollTop: 120,
        })).toBe(true);
    });

    it('releases wheel input once the sidebar is already at the matching edge', () => {
        expect(canConsumeDesktopSidebarWheel({
            deltaY: 120,
            rightScrollMax: 600,
            rightScrollTop: 600,
        })).toBe(false);

        expect(canConsumeDesktopSidebarWheel({
            deltaY: -120,
            rightScrollMax: 600,
            rightScrollTop: 0,
        })).toBe(false);
    });
});

describe('shouldCaptureDesktopSidebarScroll', () => {
    const baseMetrics = {
        deltaY: 120,
        leftBottom: 780,
        rightScrollMax: 600,
        rightScrollTop: 120,
        sectionBottom: 1400,
        sectionTop: 72,
        topOffset: 72,
        viewportHeight: 800,
    };

    it('captures downward scroll once the left column has finished and the right column can still scroll', () => {
        expect(shouldCaptureDesktopSidebarScroll(baseMetrics)).toBe(true);
    });

    it('does not capture while the left column still extends below the viewport', () => {
        expect(shouldCaptureDesktopSidebarScroll({
            ...baseMetrics,
            leftBottom: 920,
        })).toBe(false);
    });

    it('does not capture when the section has not reached the sticky zone yet', () => {
        expect(shouldCaptureDesktopSidebarScroll({
            ...baseMetrics,
            sectionTop: 140,
        })).toBe(false);
    });

    it('does not capture downward scroll when the right column is already at its bottom', () => {
        expect(shouldCaptureDesktopSidebarScroll({
            ...baseMetrics,
            rightScrollTop: 600,
        })).toBe(false);
    });

    it('captures upward scroll while the right column still has internal scroll to unwind', () => {
        expect(shouldCaptureDesktopSidebarScroll({
            ...baseMetrics,
            deltaY: -120,
            rightScrollTop: 320,
        })).toBe(true);
    });

    it('does not capture once the desktop section is no longer overlapping the sticky zone', () => {
        expect(shouldCaptureDesktopSidebarScroll({
            ...baseMetrics,
            sectionBottom: 60,
        })).toBe(false);
    });
});
