import ChatManagementClient from './ChatManagementClient'
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata'

export const metadata = buildNoIndexPageMetadata({
    title: 'Chat - Merchant Dashboard',
    description: 'View and respond to customer chats.',
})

export default function MerchantChatPage() {
    return <ChatManagementClient />
}
