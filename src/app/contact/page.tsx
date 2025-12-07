import { Metadata } from 'next'
import ContactClient from './ContactClient'

export const metadata: Metadata = {
    title: 'Contact Us | Genie.ph',
    description: 'Get in touch with Genie.ph. We are located at Skyview Park, Nivel Hills, Cebu City.',
}

export default function ContactPage() {
    return <ContactClient />
}
