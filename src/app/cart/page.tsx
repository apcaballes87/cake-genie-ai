import CartClient from './CartClient'
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata'

export const metadata = buildNoIndexPageMetadata({
    title: 'Shopping Cart',
    description: 'Review your custom cake designs and proceed to checkout.',
})

export default function CartPage() {
    return <CartClient />
}
