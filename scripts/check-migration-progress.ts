import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseKey)
const bucketUrl = `${supabaseUrl}/storage/v1/object/public/cakegenie/analysis-cache/`

async function getCounts() {
    console.log('Connecting to database to get counts...')

    // Get total count
    const { count: totalCount, error: totalError } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*', { count: 'exact', head: true })

    if (totalError) {
        console.error('Error fetching total:', totalError)
        return
    }

    // Get processed count (starts with our bucket URL)
    const { count: processedCount, error: processedError } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*', { count: 'exact', head: true })
        .like('original_image_url', `${bucketUrl}%`)

    if (processedError) {
        console.error('Error fetching processed count:', processedError)
        return
    }

    // Get external / unprocessed count
    const { count: unprocessedCount, error: unprocessedError } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*', { count: 'exact', head: true })
        .not('original_image_url', 'like', `${bucketUrl}%`)

    if (unprocessedError) {
        console.error('Error fetching unprocessed count:', unprocessedError)
        return
    }


    // Get rows missing slugs
    const { count: missingSlugCount, error: slugError } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*', { count: 'exact', head: true })
        .is('slug', null)

    if (slugError) {
        console.error('Error fetching missing slug count:', slugError)
        return
    }

    // Get rows missing image URLs
    const { count: missingUrlCount, error: urlError } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*', { count: 'exact', head: true })
        .is('original_image_url', null)

    if (urlError) {
        console.error('Error fetching missing URL count:', urlError)
        return
    }

    console.log('--- Migration Progress ---')
    console.log(`Total Rows: ${totalCount}`)
    console.log(`Processed (Supabase URLs): ${processedCount}`)
    console.log(`Remaining (External URLs): ${unprocessedCount}`)
    console.log(`Missing Slugs (Skipped): ${missingSlugCount}`)
    console.log(`Missing Image URLs (Skipped): ${missingUrlCount}`)

    if (totalCount !== null && processedCount !== null) {
        const processedTotal = Number(processedCount)
        const validTotal = Number(totalCount) - Number(missingSlugCount || 0) - Number(missingUrlCount || 0)
        const percentage = ((processedTotal / validTotal) * 100).toFixed(2);
        console.log(`Effective Completion: ${percentage}% of valid rows`)
    }
}

getCounts()
