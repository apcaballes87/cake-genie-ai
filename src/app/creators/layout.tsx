import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Genie.ph Creator Network | Connect & Earn',
    description: 'Join the Genie.ph Creator Network. Share your custom cake journey, earn 20% commission on referrals, get a massive 50% personal discount, and a free bento cake!',
    openGraph: {
        title: 'Genie.ph Creator Network | Connect & Earn',
        description: 'Join the Genie.ph Creator Network. Share your custom cake journey, earn 20% commission on referrals, get a massive 50% personal discount, and a free bento cake!',
        images: [
            {
                url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/creators-collab-ugc-hero-image.webp',
                width: 1200,
                height: 630,
                alt: 'Genie.ph Creator Collaboration Hero',
            },
        ],
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Genie.ph Creator Network | Connect & Earn',
        description: 'Join the Genie.ph Creator Network. Share your custom cake journey, earn 20% commission on referrals, get a massive 50% personal discount, and a free bento cake!',
        images: ['https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/creators-collab-ugc-hero-image.webp'],
    },
};

export default function CreatorsLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
