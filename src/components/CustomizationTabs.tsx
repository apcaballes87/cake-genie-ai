import React from 'react';
import { Cake, Palette, MessageSquare, Star } from 'lucide-react';

interface CustomizationTabsProps {
    activeTab: string | null;
    onTabClick: (tab: string) => void;
    className?: string; // Allow passing className for layout
}

export const CustomizationTabs: React.FC<CustomizationTabsProps> = ({
    activeTab,
    onTabClick,
    className = ''
}) => {
    const tabs = [
        { id: 'options', label: 'Cake Options', icon: Cake },
        { id: 'icing', label: 'Icing Colors', icon: Palette },
        { id: 'messages', label: 'Cake Messages', icon: MessageSquare },
        { id: 'toppers', label: 'Cake Toppers', icon: Star },
    ];

    return (
        <div className={`w-full bg-white border-b border-slate-200 ${className}`}>
            <div className="flex overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabClick(tab.id)}
                            className={`
                                flex-1 flex flex-col items-center justify-center py-3 px-4 min-w-[80px]
                                transition-colors relative
                                ${isActive ? 'text-purple-700 bg-purple-50 font-semibold' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}
                            `}
                        >
                            <Icon className={`w-6 h-6 mb-1 ${isActive ? 'stroke-current' : 'stroke-current'}`} />
                            <span className="text-[11px] font-medium whitespace-nowrap">{tab.label}</span>
                            {isActive && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
