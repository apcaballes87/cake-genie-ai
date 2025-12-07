import { Metadata } from 'next';
import LandingClient from './LandingClient';

export const metadata: Metadata = {
  title: 'Genie.ph | Rush order custom cakes in Cebu!',
  description: 'Find any cake design, customize it with AI, and get instant pricing. Create your dream cake with Genie.ph\'s AI-powered platform.',
  openGraph: {
    title: 'Genie.ph | Rush order custom cakes in Cebu!',
    description: 'Find any cake design, customize it with AI, and get instant pricing.',
    images: ['https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta%20GENIE.jpg'],
    url: 'https://genie.ph/',
    type: 'website',
  },
};

export default function Home() {
  return <LandingClient />;
}
