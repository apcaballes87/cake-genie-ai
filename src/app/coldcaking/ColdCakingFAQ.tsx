'use client';

import React from 'react';

const faqs = [
    {
        question: 'What is Cold Caking?',
        answer: 'Cold Caking is the practice of printing professional content — pitch decks, seed memos, traction data, funding requests, or any custom image — directly onto edible cake frosting. It\'s a bold, creative outreach tactic that turns a cake into a conversation starter. The term gained traction after founders began sending custom-printed "pitch cakes" to VCs and decision-makers to stand out from the crowd.',
    },
    {
        question: 'What can I print on a cake?',
        answer: 'Almost anything visual — pitch decks, one-pagers, seed memos, traction charts, QR codes, logos, photos, memes, resumes, invitations, or any custom design. If you can upload it as an image, we can print it on edible frosting. The key is making sure the image is high-resolution and the text is large enough to be legible on the cake surface.',
    },
    {
        question: 'How does the edible printing process work?',
        answer: 'Your uploaded image is printed using food-grade edible ink onto a thin edible sugar sheet (also called icing sheet or frosting sheet). This sheet is then carefully placed on top of the cake\'s frosting, where it blends seamlessly with the surface. The result is a vivid, full-color reproduction of your image that\'s completely safe to eat.',
    },
    {
        question: 'What image formats and resolutions work best?',
        answer: 'We recommend uploading high-resolution images (at least 300 DPI) in PNG, JPG, or WEBP format. For text-heavy content like pitch decks or memos, make sure the font size is at least 14pt equivalent so it remains readable on the cake. Vector graphics and clean layouts reproduce best on edible prints.',
    },
    {
        question: 'How long does it take to get my cold cake?',
        answer: 'Standard orders are typically ready within 2-3 business days. Rush orders may be available depending on baker availability — you\'ll see estimated delivery timelines during the customization process. For time-sensitive outreach (like sending pitch cakes before a demo day), we recommend ordering at least 4-5 days in advance.',
    },
    {
        question: 'Is the edible ink food-safe?',
        answer: 'Yes, absolutely. All edible inks and sugar sheets used in our printing process are FDA-approved and made from food-grade ingredients. They are completely safe for consumption and are widely used in professional bakeries worldwide.',
    },
    {
        question: 'Can I customize the cake flavor and size?',
        answer: 'Yes! The printed image goes on top of a fully customizable cake. You can choose your preferred cake type (round, square, sheet), size, thickness, icing flavor, and more. Whether you want a classic chocolate cake with your pitch deck on top or a vanilla sheet cake featuring your startup\'s traction metrics — it\'s all possible.',
    },
];

export const ColdCakingFAQ = React.memo(() => {
    return (
        <div className="w-full pb-4 pt-1">
            <section className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 p-4 md:p-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4 text-center">Frequently Asked Questions about Cold Caking</h2>
                <div className="space-y-3">
                    {faqs.map((faq, index) => (
                        <details
                            key={faq.question}
                            className="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-md"
                            {...(index === 0 ? { open: true } : {})}
                        >
                            <summary className="flex items-center justify-between p-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                <span className="font-semibold text-slate-700 group-open:text-purple-900 text-sm">{faq.question}</span>
                                <svg className="w-5 h-5 text-slate-400 transition-transform duration-300 group-open:rotate-180 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </summary>
                            <div className="px-4 pb-4 text-sm text-slate-600 leading-relaxed">{faq.answer}</div>
                        </details>
                    ))}
                </div>
            </section>
        </div>
    );
});

ColdCakingFAQ.displayName = 'ColdCakingFAQ';
