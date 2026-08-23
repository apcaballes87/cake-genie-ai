import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
})

const dataDir = join(dirname(fileURLToPath(import.meta.url)), 'supplier-data')

const categories = [
  'entertainment', 'catering', 'photo_video', 'hosting', 'band_music',
  'coordinator', 'styling_decor', 'flowers', 'lights_sounds', 'mobile_bar',
  'hair_makeup', 'invites_souvenirs', 'transportation', 'rentals', 'other'
]

// Build a map of business_name -> { address, email } from all data files
const supplierMap = new Map()
for (const cat of categories) {
  try {
    const suppliers = JSON.parse(readFileSync(join(dataDir, `${cat}.json`), 'utf8'))
    for (const s of suppliers) {
      if (s.address || s.email) {
        supplierMap.set(s.business_name, { address: s.address || null, email: s.email || null })
      }
    }
  } catch {}
}

console.log(`Found ${supplierMap.size} suppliers with address/email data`)

async function main() {
  // Get all existing suppliers
  const { data: existing, error } = await supabase
    .from('cakegenie_supplier_signups')
    .select('id, business_name, address, email')
    .eq('source', 'admin-seed')

  if (error) {
    console.error('Failed to read suppliers:', error)
    process.exit(1)
  }

  console.log(`Found ${existing.length} admin-seeded suppliers in DB`)

  let updated = 0
  let skipped = 0

  for (const row of existing) {
    const data = supplierMap.get(row.business_name)
    if (!data) {
      skipped++
      continue
    }

    // Only update if we have new data and the row doesn't already have it
    const needsUpdate = (data.address && !row.address) || (data.email && !row.email)
    if (!needsUpdate) {
      skipped++
      continue
    }

    const updateObj = {}
    if (data.address && !row.address) updateObj.address = data.address
    if (data.email && !row.email) updateObj.email = data.email

    const { error: updateError } = await supabase
      .from('cakegenie_supplier_signups')
      .update(updateObj)
      .eq('id', row.id)

    if (updateError) {
      console.error(`Failed to update ${row.business_name}:`, updateError.message)
    } else {
      updated++
      console.log(`Updated ${row.business_name}: ${JSON.stringify(updateObj)}`)
    }
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped`)
}

main()
