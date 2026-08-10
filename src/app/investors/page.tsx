import InvestorSignupClient from './InvestorSignupClient'
import { buildMarketingPageMetadata } from '@/lib/utils/metadata'

export const metadata = buildMarketingPageMetadata({
  title: "Follow Genie.ph's Journey",
  description: 'Receive occasional investor updates on Genie.ph’s growth, product progress, and milestones.',
  canonicalPath: 'https://genie.ph/investors',
})

export default function InvestorsPage() {
  return <InvestorSignupClient />
}
