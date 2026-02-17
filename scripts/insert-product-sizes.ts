import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check your .env.local file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertProductSizes() {
  const products = [
    {
      cakesize: '8x8',
      price: 1499,
      type: 'Square',
      thickness: '4 in',
      display_order: 999
    },
    {
      cakesize: '10x10',
      price: 1799,
      type: 'Square',
      thickness: '4 in',
      display_order: 999
    }
  ]

  console.log('Inserting product sizes...')
  
  const { data, error } = await supabase
    .from('productsizes_cakegenie')
    .insert(products)
    .select()

  if (error) {
    console.error('Error inserting products:', error.message)
    process.exit(1)
  }

  console.log('Successfully inserted products:')
  console.table(data)
}

insertProductSizes()
  .catch(console.error)
