import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
})

// Maps a CLI category key to the table's business_type enum value.
const CATEGORY_TO_TYPE = {
  cakes: 'cakes',
  photo_video: 'photo_video',
  catering: 'catering',
  hosting: 'hosting',
  band_music: 'band_music',
  coordinator: 'coordinator',
  styling_decor: 'styling_decor',
  flowers: 'flowers',
  lights_sounds: 'lights_sounds',
  venue: 'venue',
  rentals: 'rentals',
  mobile_bar: 'mobile_bar',
  entertainment: 'entertainment',
  hair_makeup: 'hair_makeup',
  invites_souvenirs: 'invites_souvenirs',
  transportation: 'transportation',
  other: 'other',
}

const category = process.argv[2]
if (!category) {
  console.error('Usage: node --env-file=.env.local scripts/seed-cebu-suppliers.mjs <category>')
  process.exit(1)
}

const businessType = CATEGORY_TO_TYPE[category]
if (!businessType) {
  console.error(`Unknown category "${category}". Add it to CATEGORY_TO_TYPE in this script.`)
  process.exit(1)
}

const dataPath = join(dirname(fileURLToPath(import.meta.url)), 'supplier-data', `${category}.json`)

let suppliers
try {
  suppliers = JSON.parse(readFileSync(dataPath, 'utf8'))
} catch (err) {
  console.error(`Failed to read ${dataPath}:`, err.message)
  process.exit(1)
}

async function main() {
  const { data: existing, error: selectError } = await supabase
    .from('cakegenie_supplier_signups')
    .select('business_name')
    .in('status', ['new', 'reviewing', 'approved'])

  if (selectError) {
    console.error('Failed to read existing suppliers:', selectError)
    process.exit(1)
  }

  const existingNames = new Set((existing || []).map((r) => r.business_name))
  const toInsert = suppliers.filter((s) => !existingNames.has(s.business_name))

  if (toInsert.length === 0) {
    console.log('All suppliers already present. Nothing to insert.')
    return
  }

  const rows = toInsert.map((s) => ({
    name: s.name,
    contact_number: s.contact_number,
    business_name: s.business_name,
    description: s.description,
    business_type: businessType,
    facebook_page_url: s.facebook_page_url ?? s.website ?? null,
    website_url: s.website_url ?? s.website ?? null,
    extra_link_url: s.extra_link_url ?? null,
    profile_photo_url: s.profile_photo_url ?? null,
    cover_photo_url: s.cover_photo_url ?? null,
    status: 'approved',
    reviewed_at: new Date().toISOString(),
    source: 'admin-seed',
    metadata: s.metadata ?? {},
  }))

  const { data, error } = await supabase
    .from('cakegenie_supplier_signups')
    .insert(rows)
    .select('id, business_name')

  if (error) {
    console.error('Insert failed:', error)
    process.exit(1)
  }

  console.log(`Inserted ${data.length} ${category} suppliers (business_type=${businessType}):`)
  for (const r of data) console.log(` - ${r.business_name} (${r.id})`)
}

main()
