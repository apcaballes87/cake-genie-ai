'use client'

import React from 'react'
import Link from 'next/link'
import { CreditCard, Smartphone, Building2, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react'

const PAYMENT_CATEGORIES = [
    {
        title: 'E-Wallets',
        description: 'Pay instantly using your favorite e-wallet apps. No bank account needed.',
        icon: Smartphone,
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
        methods: [
            {
                name: 'GCash',
                logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/gcash.jpg',
                description: 'Philippines\u2019 #1 e-wallet. Pay directly from your GCash balance.',
            },
            {
                name: 'Maya',
                logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/maya.jpg',
                description: 'Fast and secure payments via Maya (formerly PayMaya).',
            },
            {
                name: 'ShopeePay',
                logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/shopeepay.jpg',
                description: 'Use your ShopeePay wallet for seamless checkout.',
            },
        ],
    },
    {
        title: 'Credit & Debit Cards',
        description: 'Securely pay with your Visa or Mastercard. Supports both credit and debit cards.',
        icon: CreditCard,
        iconBg: 'bg-purple-50',
        iconColor: 'text-purple-600',
        methods: [
            {
                name: 'Visa',
                logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/visa.jpg',
                description: 'All Visa credit and debit cards accepted.',
            },
            {
                name: 'Mastercard',
                logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/mastercard.jpg',
                description: 'All Mastercard credit and debit cards accepted.',
            },
        ],
    },
    {
        title: 'Online Banking',
        description: 'Pay directly from your bank account via online banking transfer.',
        icon: Building2,
        iconBg: 'bg-green-50',
        iconColor: 'text-green-600',
        methods: [
            {
                name: 'BPI',
                logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/bpi.jpg',
                description: 'Pay via BPI Online or the BPI mobile app.',
            },
            {
                name: 'BDO',
                logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/bdo.jpg',
                description: 'Pay via BDO Online Banking or BDO mobile app.',
            },
        ],
    },
    {
        title: 'Over-the-Counter',
        description: 'No online account? Pay at physical partner outlets near you.',
        icon: Building2,
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
        methods: [
            {
                name: 'Palawan',
                logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/palawan.jpg',
                description: 'Pay at any Palawan Pawnshop / Palawan Express branch nationwide.',
            },
        ],
    },
]

const FAQS = [
    {
        question: 'Is it safe to pay online on Genie.ph?',
        answer: 'Absolutely. All payments are processed through Xendit, a PCI DSS-compliant payment gateway trusted by thousands of businesses in the Philippines and Southeast Asia. Your card details are never stored on our servers.',
    },
    {
        question: 'When will I be charged?',
        answer: 'You will be charged immediately after confirming your payment at checkout. Once your payment is verified, your order is placed with our partner bakeshop.',
    },
    {
        question: 'What happens if my payment fails?',
        answer: 'If a payment fails, your order will not be placed and you won\u2019t be charged. You can try again with the same or a different payment method. If the issue persists, please contact our support team.',
    },
    {
        question: 'Can I pay cash on delivery?',
        answer: 'Currently, we only accept online payments to ensure faster order confirmation and a smooth experience for both you and our partner bakeshops. We plan to add more payment options in the future.',
    },
    {
        question: 'Do you accept installment payments?',
        answer: 'We do not currently support installment plans. However, if your credit card issuer offers installment conversion on your transactions, you may contact them to convert your purchase.',
    },
]

export default function PaymentOptionsClient() {
    return (
        <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center p-3 bg-pink-100 rounded-full mb-4">
                        <CreditCard className="w-8 h-8 text-pink-600" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4 font-serif">
                        Payment Options
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                        We accept a variety of secure payment methods so you can order your dream cake the way that&apos;s most convenient for you.
                    </p>
                </div>

                {/* Security Badge */}
                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 mb-12">
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                        <div className="shrink-0 bg-emerald-50 p-4 rounded-full">
                            <ShieldCheck className="w-10 h-10 text-emerald-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Secure Payments via Xendit</h2>
                            <p className="text-slate-600">
                                All transactions are encrypted and processed by <strong>Xendit</strong>, a PCI DSS-compliant payment gateway.
                                Your sensitive information is never stored on our servers. Pay with confidence knowing your data is protected.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Payment Categories */}
                <div className="space-y-10 mb-16">
                    {PAYMENT_CATEGORIES.map((category) => {
                        const IconComponent = category.icon
                        return (
                            <section key={category.title}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-2 rounded-lg ${category.iconBg}`}>
                                        <IconComponent className={`w-5 h-5 ${category.iconColor}`} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900">{category.title}</h2>
                                        <p className="text-sm text-slate-500">{category.description}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {category.methods.map((method) => (
                                        <div
                                            key={method.name}
                                            className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:border-pink-300 hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <img
                                                    src={method.logoUrl}
                                                    alt={method.name}
                                                    width={48}
                                                    height={32}
                                                    className="h-8 w-12 object-contain rounded bg-white"
                                                />
                                                <h3 className="font-semibold text-slate-800">{method.name}</h3>
                                            </div>
                                            <p className="text-sm text-slate-500 leading-relaxed">{method.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )
                    })}
                </div>

                {/* How Payment Works */}
                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 mb-12">
                    <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center font-serif">How Payment Works</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                                step: '1',
                                title: 'Add to Cart',
                                desc: 'Browse cakes, customize your design, and add items to your cart.',
                            },
                            {
                                step: '2',
                                title: 'Choose Payment',
                                desc: 'At checkout, select your preferred payment method from the options above.',
                            },
                            {
                                step: '3',
                                title: 'Confirm & Done',
                                desc: 'Complete your payment securely. You\u2019ll receive an order confirmation instantly.',
                            },
                        ].map((item) => (
                            <div key={item.step} className="text-center">
                                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-pink-100 text-pink-600 font-bold text-lg mb-3">
                                    {item.step}
                                </div>
                                <h3 className="font-semibold text-slate-800 mb-1">{item.title}</h3>
                                <p className="text-sm text-slate-500">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* FAQs */}
                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-12">
                    <h2 className="text-2xl font-bold text-slate-900 mb-6 font-serif text-center">Frequently Asked Questions</h2>
                    <div className="space-y-6">
                        {FAQS.map((faq, index) => (
                            <div key={index} className="border-b border-slate-100 last:border-0 pb-6 last:pb-0">
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">{faq.question}</h3>
                                <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Note */}
                <div className="bg-amber-50 rounded-xl p-4 flex gap-3 border border-amber-200 mb-12">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                        <strong>Note:</strong> Payment options may vary depending on your location and the amount of your order. If you encounter any issues during checkout, please don&apos;t hesitate to contact our support team.
                    </p>
                </div>

                {/* CTA */}
                <div className="text-center">
                    <Link
                        href="/customizing"
                        className="inline-flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-8 py-4 rounded-full text-lg font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
                    >
                        Start Your Custom Order
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>

            </div>
        </main>
    )
}
