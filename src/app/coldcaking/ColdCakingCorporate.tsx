'use client';

import React from 'react';
import Link from 'next/link';

const corporateReasons = [
    {
        emoji: '🎯',
        title: 'Get Noticed',
        description: 'Stand out from the sea of generic gifts. A custom-printed cake with your brand, message, or visual makes an unforgettable impression.',
    },
    {
        emoji: '🗣️',
        title: 'Get Heard',
        description: 'Turn every celebration into storytelling. Print your pitch, metrics, or brand message on cake — sparks conversations naturally.',
    },
    {
        emoji: '💝',
        title: 'Make Employees Feel Appreciated',
        description: 'Celebrate work anniversaries, promotions, birthdays, and wins with personalized cakes. Show your team they matter beyond the spreadsheet.',
    },
    {
        emoji: '🤝',
        title: 'Make Clients Feel Valued',
        description: 'Strengthen relationships with thoughtful gestures. Custom cakes for client celebrations build emotional connection beyond transactions.',
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
        <section className="py-4 md:py-6">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <h2 className="text-[22px] md:text-[28px] font-bold text-gray-900 mb-4">
                    Corporate Gifting That Actually Works for Your Business
                </h2>
                <div className="prose prose-base md:prose-lg mx-auto text-gray-600 space-y-4 md:space-y-6 leading-relaxed">
                    <p>
                        <strong>Custom cakes turn every celebration into a strategic opportunity.</strong> Print your brand, message, or visuals on a custom cake to get noticed, get heard, and make people feel appreciated — all while enjoying a delicious, memorable treat.
                    </p>

                    <ul className="text-left space-y-3 list-none pl-0">
                        {corporateReasons.map((reason) => (
                            <li key={reason.title} className="flex items-start">
                                <span className="text-purple-500 mr-2 mt-1">{reason.emoji}</span>
                                <span><strong>{reason.title}</strong> — {reason.description}</span>
                            </li>
                        ))}
                    </ul>

                    <h3 className="text-[18px] md:text-[21px] font-bold text-gray-800 mt-6 mb-2">
                        Perfect for Every Corporate Occasion
                    </h3>
                    <p>
                        Whether it's employee appreciation, client retention, or prospect outreach — we've got you covered:
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm font-semibold text-purple-700 mt-4">
                        {occasions.map((occasion) => (
                            <Link
                                key={occasion.label}
                                href={occasion.href}
                                className="bg-purple-50 py-2 px-4 rounded-lg hover:bg-purple-100 transition"
                            >
                                {occasion.label}
                            </Link>
                        ))}
                    </div>

                    <p className="mt-5">
                        Your corporate cake wish, granted. Upload your design or browse our corporate templates today.
                    </p>
                </div>
            </div>
        </section>
    );
});

ColdCakingCorporate.displayName = 'ColdCakingCorporate';
