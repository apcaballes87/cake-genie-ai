'use server'

import { getDesignsByKeyword } from "@/services/supabaseService"

export async function fetchMoreDesigns(keyword: string, offset: number) {
    const { data } = await getDesignsByKeyword(keyword, 30, offset)
    return data || []
}
