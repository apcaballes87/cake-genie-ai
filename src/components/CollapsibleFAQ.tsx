import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Truck, Clock, CreditCard, DollarSign, Zap, CalendarDays, Wallet, Landmark } from 'lucide-react';

interface FAQItem {
    question: string;
    answer: React.ReactNode;
    icon: React.ElementType;
}

const FAQ_ITEMS: FAQItem[] = [
    {
        question: "Where do you deliver?",
        answer: "We deliver all around Metro Cebu, including Cebu City, Mandaue, Mactan, and Talisay.",
        icon: Truck
    },
    {
        question: "When can I get my cake?",
        answer: (
            <div className="space-y-3 mt-2">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 italic">
                    <span className="font-semibold not-italic text-slate-700">Note:</span> Availability depends on the complexity of your design. We automatically calculate the fastest possible time for each specific custom cake.
                </div>

                <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="p-2 bg-white rounded-lg text-emerald-600 shadow-sm shrink-0">
                        <Zap size={18} fill="currentColor" className="text-emerald-500" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-emerald-900 text-sm">Rush Order</h4>
                            <span className="px-2 py-0.5 bg-white text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-full border border-emerald-200">
                                30 MINS - 1 HR
                            </span>
                        </div>
                        <p className="text-emerald-800 text-xs leading-relaxed">
                            Need it now? Select designs are available for immediate pickup or delivery. Perfect for last-minute celebrations!
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm shrink-0">
                        <Clock size={18} className="text-blue-500" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-blue-900 text-sm">Same Day</h4>
                            <span className="px-2 py-0.5 bg-white text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-full border border-blue-200">
                                3 - 4 HOURS
                            </span>
                        </div>
                        <p className="text-blue-800 text-xs leading-relaxed">
                            Order today, get it today. We need just a few hours to bake and decorate your cake fresh.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-xl border border-purple-100">
                    <div className="p-2 bg-white rounded-lg text-purple-600 shadow-sm shrink-0">
                        <CalendarDays size={18} className="text-purple-500" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-purple-900 text-sm">Standard Order</h4>
                            <span className="px-2 py-0.5 bg-white text-purple-700 text-[10px] font-bold uppercase tracking-wider rounded-full border border-purple-200">
                                1 DAY LEAD TIME
                            </span>
                        </div>
                        <p className="text-purple-800 text-xs leading-relaxed">
                            For complex custom designs, we need at least 1 day to ensure perfection. Order by 3 PM for next-day slots.
                        </p>
                    </div>
                </div>
            </div>
        ),
        icon: Clock
    },
    {
        question: "What payment options are available?",
        answer: (
            <div className="space-y-3 mt-2">
                <div className="flex items-start gap-3 p-3 bg-sky-50 rounded-xl border border-sky-100">
                    <div className="p-2 bg-white rounded-lg text-sky-600 shadow-sm shrink-0">
                        <Wallet size={18} className="text-sky-500" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-sky-900 text-sm">E-Wallets</h4>
                        </div>
                        <p className="text-sky-800 text-xs leading-relaxed">
                            We accept payments via <strong>GCash</strong> and <strong>Maya</strong> for fast and secure transactions.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                    <div className="p-2 bg-white rounded-lg text-indigo-600 shadow-sm shrink-0">
                        <Landmark size={18} className="text-indigo-500" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-indigo-900 text-sm">Bank Transfer</h4>
                        </div>
                        <p className="text-indigo-800 text-xs leading-relaxed">
                            Direct transfers available for major banks including <strong>BDO</strong>, <strong>BPI</strong>, and <strong>Metrobank</strong>.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-rose-50 rounded-xl border border-rose-100">
                    <div className="p-2 bg-white rounded-lg text-rose-600 shadow-sm shrink-0">
                        <CreditCard size={18} className="text-rose-500" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-rose-900 text-sm">Credit/Debit Cards</h4>
                        </div>
                        <p className="text-rose-800 text-xs leading-relaxed">
                            We accept all major credit and debit cards securely via Xendit.
                        </p>
                    </div>
                </div>
            </div>
        ),
        icon: CreditCard
    },
    {
        question: "How do customization options affect the price?",
        answer: "The options you choose can change the total price. For example, changing a toy topper to a printed topper can reduce the price. Each choice you make can either reduce or increase the final amount.",
        icon: DollarSign
    }
];

const CollapsibleFAQ: React.FC = () => {
    // Track which item is open (null means all closed). 
    // If you want multiple open at once, use an array or set.
    // For a cleaner look, often an accordion (one active) is nice, but user didn't specify.
    // Let's stick to allowing independent toggling for flexibility.
    const [openIndices, setOpenIndices] = useState<number[]>([0]); // Default first one open? Or all closed? Let's verify user preference. "collapsible". Let's start with all closed or first one open. Let's keep all closed initially or first one open for engagement. Let's keep first one open.

    const toggleItem = (index: number) => {
        setOpenIndices(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
    };

    return (
        <div className="w-full mx-auto mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 text-center">Frequently Asked Questions</h2>
            <div className="space-y-3">
                {FAQ_ITEMS.map((item, index) => {
                    const isOpen = openIndices.includes(index);
                    const Icon = item.icon;
                    return (
                        <div
                            key={index}
                            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-md"
                        >
                            <button
                                onClick={() => toggleItem(index)}
                                className="w-full flex items-center justify-between p-4 text-left focus:outline-none"
                                aria-expanded={isOpen}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${isOpen ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'} transition-colors`}>
                                        <Icon size={20} />
                                    </div>
                                    <span className={`font-semibold ${isOpen ? 'text-purple-900' : 'text-slate-700'}`}>
                                        {item.question}
                                    </span>
                                </div>
                                <div className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                                    <ChevronDown size={20} />
                                </div>
                            </button>

                            <div
                                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                                    }`}
                            >
                                <div className="p-4 pt-0 text-slate-600 text-sm leading-relaxed">
                                    {item.answer}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CollapsibleFAQ;
