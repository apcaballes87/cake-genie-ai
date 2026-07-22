'use server'

import { getDesignsByKeyword } from "@/services/supabaseService"
import { getPublicCrawlerImageManifest, selectCrawlerImage } from "@/lib/seo/crawlerImage"

export async function fetchMoreDesigns(keyword: string, offset: number) {
    const { data } = await getDesignsByKeyword(keyword, 30, offset)
    const rows = data || []
    const designs = rows.map((design) => {
        const image = selectCrawlerImage(design)
        return {
            ...design,
            original_image_url: image.url,
            studio_edited_image_url: null,
            image_variants: getPublicCrawlerImageManifest(design.image_variants),
        }
    }).filter((design) => Boolean(design.original_image_url))

    return {
        designs,
        reachedEnd: rows.length < 30,
    }
}
