import { Metadata } from 'next';
import LandingClient from './LandingClient';

export const metadata: Metadata = {
  title: 'Genie.ph | Online Marketplace for Custom Cakes in Cebu!',
  description: 'Upload any cake design, customize with AI and get instant pricing from the best cakeshops and homebakers here in Cebu.',
  openGraph: {
    title: 'Genie.ph | Online Marketplace for Custom Cakes in Cebu!',
    description: 'Upload any cake design, customize with AI and get instant pricing from the best cakeshops and homebakers here in Cebu.',
    images: ['https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta%20GENIE.jpg'],
    url: 'https://genie.ph/',
    type: 'website',
  },
};

export default function Home() {
  return <LandingClient />;
}
