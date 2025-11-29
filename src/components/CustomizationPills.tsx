import React, { useRef, useEffect } from 'react';

interface Tab {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

interface CustomizationPillsProps {
    tabs: Tab[];
    activeTab: string | null;
    onTabSelect: (id: string) => void;
    className?: string;
}

export const CustomizationPills: React.FC<CustomizationPillsProps> = ({
    tabs,
    activeTab,
    onTabSelect,
    className = ''
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Scroll active tab into view
    useEffect(() => {
        if (activeTab && containerRef.current) {
            const activeElement = containerRef.current.querySelector(`[data-tab-id="${activeTab}"]`);
            if (activeElement) {
                activeElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }
        }
    }, [activeTab]);

    return (
        <div
            ref={containerRef}
            className={`flex flex-row overflow-x-auto gap-2 py-1.5 px-2 no-scrollbar snap-x ${className}`}
            style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch'
            }}
        >
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;

                return (
                    <button
                        key={tab.id}
                        data-tab-id={tab.id}
                        onClick={() => onTabSelect(tab.id)}
                        className={`
                            flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 snap-center
                            ${isActive
                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-200 scale-105'
                                : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300 hover:bg-purple-50 shadow-sm'
                            }
                        `}
                    >
                        {tab.icon && <span className="w-3.5 h-3.5">{tab.icon}</span>}
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
};
