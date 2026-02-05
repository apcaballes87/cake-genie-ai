import Link from 'next/link';
import type { CakeGenieMerchant } from '@/lib/database.types';
import { MerchantItem } from './MerchantItem';

interface MerchantShowcaseProps {
    merchants: CakeGenieMerchant[];
}

export const MerchantShowcase = ({ merchants }: MerchantShowcaseProps) => {
    return (
        <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">Our Partner Shops</h2>
                <Link
                    href="/search?q=shops"
                    className="text-purple-600 text-sm font-bold hover:underline"
                >
                    View All
                </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-4 px-4 py-2">
                {merchants.length > 0 ? (
                    merchants.map((merchant) => (
                        <MerchantItem key={merchant.merchant_id} merchant={merchant} />
                    ))
                ) : (
                    <p className="text-gray-500 text-sm">No partner shops available yet.</p>
                )}
            </div>
        </div>
    );
};

export default MerchantShowcase;
