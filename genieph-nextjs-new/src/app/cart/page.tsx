import { Metadata } from 'next'
import CartClient from './CartClient'

export const metadata: Metadata = {
    title: 'Shopping Cart | Genie.ph',
    description: 'Review your custom cake designs and proceed to checkout.',
}

export default function CartPage() {
    return <CartClient />
}
