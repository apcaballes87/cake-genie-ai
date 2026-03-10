import PaymentOptionsClient from './PaymentOptionsClient'
import { buildMarketingPageMetadata } from '@/lib/utils/metadata'

export const metadata = buildMarketingPageMetadata({
    title: 'Payment Options and Accepted Payment Methods',
    description: 'View all accepted payment methods on Genie.ph. Pay securely with GCash, Maya, ShopeePay, Visa, Mastercard, BPI, BDO, Palawan, and more via our Xendit-powered checkout.',
    canonicalPath: 'https://genie.ph/payment-options',
})

export default function PaymentOptionsPage() {
    return <PaymentOptionsClient />
}
