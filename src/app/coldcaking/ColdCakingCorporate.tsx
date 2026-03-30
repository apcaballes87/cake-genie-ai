'use client';

import React from 'react';
import Link from 'next/link';

const corporateReasons = [
    {
        emoji: '🎯',
        title: 'Get Noticed',
        description: 'Stand out from the sea of generic gifts. A custom-printed cake with your brand, message, or visual makes an unforgettable impression that competitors simply can\'t match.',
    },
    {
        emoji: '🗣️',
        title: 'Get Heard',
        description: 'Turn every celebration into a storytelling opportunity. Print your pitch, key metrics, or brand message on cake — it sparks conversations and reinforces your value proposition organically.',
    },
    {
        emoji: '💝',
        title: 'Make Employees Feel Appreciated',
        description: 'Celebrate work anniversaries, promotions, birthdays, and team wins with personalized cakes. Show your team they matter beyond the spreadsheet — boost morale and build loyalty.',
    },
    {
        emoji: '🤝',
        title: 'Make Clients Feel Valued',
        description: 'Strengthen business relationships with thoughtful gestures. A custom cake for client celebrations, project wins, or holiday greetings builds emotional connection beyond transactions.',
    },
];

const occasions = [
    { label: 'Employee Giveaways', href: '/search?q=corporate+cakes' },
    { label: 'Team Building', href: '/search?q=team+cakes' },
    { label: 'Client Appreciation', href: '/search?q=client+gift+cakes' },
    { label: 'Product Launches', href: '/search?q=launch+cakes' },
    { label: 'Holiday Gifts', href: '/search?q=holiday+cakes' },
    { label: 'Milestone Celebrations', href: '/search?q=milestone+cakes' },
];

export const ColdCakingCorporate = React.memo(() => {
    return (
        <section className="py-6 md:py-10">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-3xl p-6 md:p-10 text-white shadow-2xl">
                    <div className="text-center mb-8">
                        <span className="inline-block px-3 py-1 bg-purple-500/30 rounded-full text-purple-200 text-xs font-semibold tracking-wide uppercase mb-3">
                            Corporate & B2B Solutions
                        </span>
                        <h2 className="text-2xl md:text-3xl font-bold mb-3">
                            Make Your Corporate Gifting Actually Work for You
                        </h2>
                        <p className="text-purple-100 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                            Stop sending generic gift baskets that blend into the noise. Cold cakes help you{' '}
                            <strong>get noticed, get heard, and make people feel appreciated</strong> — all while enjoying a delicious, custom-designed cake.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                        {corporateReasons.map((reason) => (
                            <div
                                key={reason.title}
                                className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:bg-white/15 transition-colors"
                            >
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl shrink-0">{reason.emoji}</span>
                                    <div>
                                        <h3 className="font-bold text-white text-base mb-1">{reason.title}</h3>
                                        <p className="text-purple-100 text-sm leading-relaxed">{reason.description}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="text-center">
                        <p className="text-purple-200 text-sm font-medium mb-4">
                            Perfect for employee engagement, client retention, and prospect outreach
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {occasions.map((occasion) => (
                                <Link
                                    key={occasion.label}
                                    href={occasion.href}
                                    className="px-4 py-2 bg-purple-600/80 hover:bg-purple-500 text-white text-sm font-semibold rounded-full transition-colors"
                                >
                                    {occasion.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
});

ColdCakingCorporate.displayName = 'ColdCakingCorporate';
