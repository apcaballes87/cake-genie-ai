import Link from 'next/link';
import Image from 'next/image';

interface PopularDesign {
    slug: string;
    keywords: string;
    original_image_url: string;
    price: number;
    alt_text: string;
}

interface PopularDesignsProps {
    designs: PopularDesign[];
}

export const PopularDesigns = ({ designs }: PopularDesignsProps) => {
    if (!designs || designs.length === 0) return null;

    return (
        <section className="py-12 md:py-16 bg-gradient-to-b from-purple-50/50 to-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-8">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                        Popular Cake Designs
                    </h2>
                    <p className="text-gray-500 mt-2">Trending designs loved by our community in Cebu</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
                    {designs.map((design) => (
                        <Link
                            key={design.slug}
                            href={`/customizing/${design.slug}`}
                            className="group bg-white rounded-2xl shadow-sm hover:shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 hover:-translate-y-1"
                        >
                            <div className="relative aspect-square bg-gray-100">
                                <Image
                                    src={design.original_image_url}
                                    alt={design.alt_text || `${design.keywords} cake design`}
                                    fill
                                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    unoptimized
                                />
                            </div>
                            <div className="p-3">
                                <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 group-hover:text-purple-600 transition-colors">
                                    {(() => {
                                        const title = design.keywords.split(',')[0].trim();
                                        return title.toLowerCase().endsWith('cake') ? title : `${title} Cake`;
                                    })()}
                                </h3>
                                <p className="text-purple-600 font-bold text-sm mt-1">
                                    ₱{design.price.toLocaleString()}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>

                <div className="text-center mt-8">
                    <Link
                        href="/customizing"
                        className="inline-block border border-purple-300 text-purple-600 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-purple-50 transition-colors"
                    >
                        Browse All Cake Designs
                    </Link>
                </div>
            </div>
        </section>
    );
};
