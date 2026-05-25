interface DesktopSidebarScrollMetrics {
    deltaY: number;
    leftBottom: number;
    rightScrollMax: number;
    rightScrollTop: number;
    sectionBottom: number;
    sectionTop: number;
    topOffset: number;
    viewportHeight: number;
}

interface DesktopSidebarWheelMetrics {
    deltaY: number;
    rightScrollMax: number;
    rightScrollTop: number;
}

export const canConsumeDesktopSidebarWheel = ({
    deltaY,
    rightScrollMax,
    rightScrollTop,
}: DesktopSidebarWheelMetrics): boolean => {
    if (deltaY === 0 || rightScrollMax <= 0) {
        return false;
    }

    if (deltaY > 0) {
        return rightScrollTop < rightScrollMax;
    }

    return rightScrollTop > 0;
};

export const shouldCaptureDesktopSidebarScroll = ({
    deltaY,
    leftBottom,
    rightScrollMax,
    rightScrollTop,
    sectionBottom,
    sectionTop,
    topOffset,
    viewportHeight,
}: DesktopSidebarScrollMetrics): boolean => {
    if (deltaY === 0 || rightScrollMax <= 0) {
        return false;
    }

    if (sectionTop > topOffset || sectionBottom <= topOffset) {
        return false;
    }

    if (leftBottom > viewportHeight) {
        return false;
    }

    return canConsumeDesktopSidebarWheel({
        deltaY,
        rightScrollMax,
        rightScrollTop,
    });
};
