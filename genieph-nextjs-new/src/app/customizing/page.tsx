import { Metadata } from 'next'
import CustomizingClient from './CustomizingClient'

export const metadata: Metadata = {
    title: 'Customize Your Cake | Genie.ph',
    description: 'Customize your cake design with AI-powered suggestions.',
}

export default function CustomizingPage() {
    return <CustomizingClient />
}
