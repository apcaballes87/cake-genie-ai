import { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SharedDesignClient from './SharedDesignClient'

type Props = {
    params: Promise<{ slug: string }>
}

export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { slug } = await params
    const supabase = await createClient()

    const { data: design } = await supabase
        .from('cakegenie_shared_designs')
        .select('title, description, alt_text, customized_image_url, cake_type, cake_size, final_price')
        .eq('url_slug', slug)
        .single()

    if (!design) {
        return { title: 'Design Not Found' }
    }

    const title = design.title || 'Custom Cake Design'

    // Construct a rich description for SEO
    let description = design.description || 'A beautiful custom cake design created with Genie.ph.'
    const details = []
    if (design.cake_type) details.push(`Type: ${design.cake_type}`)
    if (design.cake_size) details.push(`Size: ${design.cake_size}`)
    if (design.final_price) details.push(`Price: ₱${design.final_price.toLocaleString()}`)

    if (details.length > 0) {
        description = `${description} | ${details.join(' - ')}`
    }

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: [
                {
                    url: design.customized_image_url,
                    width: 1200,
                    height: 630,
                    alt: design.alt_text || 'Custom cake design',
                },
            ],
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [design.customized_image_url],
        },
    }
}

export default async function SharedDesignPage({ params }: Props) {
    const { slug } = await params
    const supabase = await createClient()

    const { data: design } = await supabase
        .from('cakegenie_shared_designs')
        .select('*')
        .eq('url_slug', slug)
        .single()

    if (!design) {
        notFound()
    }

    return <SharedDesignClient design={design} />
}
