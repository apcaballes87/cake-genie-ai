import { Metadata } from 'next'
import PaymentOptionsClient from './PaymentOptionsClient'

export const metadata: Metadata = {
    title: 'Payment Options | Genie.ph - Accepted Payment Methods',
    description: 'View all accepted payment methods on Genie.ph. Pay securely with GCash, Maya, ShopeePay, Visa, Mastercard, BPI, BDO, Palawan, and more via our Xendit-powered checkout.',
    alternates: {
        canonical: 'https://genie.ph/payment-options',
    },
}

export default function PaymentOptionsPage() {
    return <PaymentOptionsClient />
}
