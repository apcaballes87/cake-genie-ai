export const BLOG_TAG_CONFIG: Record<string, { label: string; description: string }> = {
    'birthday-cakes': {
        label: 'Birthday Cakes',
        description: 'Tips, guides, and inspiration for birthday cake designs and party ideas in the Philippines.',
    },
    'cebu-cakes': {
        label: 'Cebu Cakes',
        description: 'Everything about ordering, customizing, and finding the best cakes in Cebu City and Metro Cebu.',
    },
    'wedding-cakes': {
        label: 'Wedding Cakes',
        description: 'Wedding cake designs, inspiration, and guides for couples planning their big day in Cebu.',
    },
    'party-packages': {
        label: 'Party Packages',
        description: "Honest comparisons of Jollibee, McDonald's, and other party packages for kids and adults.",
    },
    'cake-comparison': {
        label: 'Cake Comparisons',
        description: 'Side-by-side comparisons of popular cake brands — Red Ribbon, Goldilocks, Mary Grace, and more.',
    },
    'character-cakes': {
        label: 'Character Cakes',
        description: 'K-pop, anime, and character-themed cake designs — Katseye, Kuromi, Disney, and more.',
    },
    'graduation-cakes': {
        label: 'Graduation Cakes',
        description: 'Graduation cake ideas, designs, and ordering tips for celebrating academic achievements.',
    },
    'kids-cakes': {
        label: 'Kids Cakes',
        description: 'Birthday cake themes and ideas for kids of all ages — toddlers, preschoolers, and beyond.',
    },
};

export function getBlogTagsForPost(keywords: string): string[] {
    const kw = keywords.toLowerCase();
    const tags: string[] = [];

    if (kw.includes('birthday')) tags.push('birthday-cakes');
    if (kw.includes('cebu') || kw.includes('metro cebu')) tags.push('cebu-cakes');
    if (kw.includes('wedding') || kw.includes('bridal')) tags.push('wedding-cakes');
    if (kw.includes('party package') || kw.includes('jollibee') || kw.includes('mcdonalds') || kw.includes('mcdonald')) tags.push('party-packages');
    if (kw.includes('goldilocks') || kw.includes('red ribbon') || kw.includes('mary grace') || kw.includes('estrel') || kw.includes('lemon square')) tags.push('cake-comparison');
    if (kw.includes('katseye') || kw.includes('kpop') || kw.includes('character cake') || kw.includes('fandom')) tags.push('character-cakes');
    if (kw.includes('graduation')) tags.push('graduation-cakes');
    if (kw.includes('kids') || kw.includes('toddler') || kw.includes('children') || kw.includes('boys') || kw.includes('girls')) tags.push('kids-cakes');

    return tags;
}

export function getPopulatedBlogCategorySlugs(posts: Array<{ keywords?: string | null }>): string[] {
    const populated = new Set(posts.flatMap((post) => getBlogTagsForPost(post.keywords || '')));
    return Object.keys(BLOG_TAG_CONFIG).filter((slug) => populated.has(slug));
}
