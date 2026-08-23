import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, 'supplier-data')

// Actual research results keyed by EXACT business_name from the data files
const updates = {
  // CATERING
  "Ayers Lechon": { address: "F. Cabahug St., Mabolo, Cebu City", email: "ayerlechon@yahoo.com" },
  "Ricos Lechon": { address: "One Paseo, Maria Luisa Road, Banilad, Cebu City", email: null },
  "Mr. Liempo": { address: "San Miguel Rd., Bang-Bang, Cordova, Cebu", email: "info@mrliempo.com" },
  "Ruthys Lechon": { address: "Pres. Quirino St., Kasambagan, Cebu City", email: null },
  "MAGIS Food Catering Services": { address: "Natalio B. Bacalso Ave, Cebu City", email: null },
  "Trippys Food Corporation": { address: "Cebu City", email: null },

  // ENTERTAINMENT - Photobooths
  "Fotomatic Cebu": { address: "Talisay, Cebu", email: "fotomatic.rental@gmail.com" },
  "360 Events Cebu": { address: "Cebu City", email: "inquiry@360eventscebu.com" },
  "Photobooth Bai": { address: "District 8, Consolacion, Cebu", email: null },
  "Elevents Photobooth": { address: "1 Montebello Dr, Brgy. Kamputhaw, Cebu City", email: "studioelevent@gmail.com" },
  "Glam Up Booths & Beyond": { address: "Cebu City", email: "glamup360cebuvideobooth@gmail.com" },
  "Photobooth by Den Production Films": { address: "Cebu City", email: "denproductionfilms@gmail.com" },
  "Xfinite Booth Rentals": { address: "Talisay, Cebu", email: null },
  "Crafted by QKC": { address: "Mandaue City, Cebu", email: null },

  // ENTERTAINMENT - Mobile Playgrounds
  "KPUP Mobile Party Playground": { address: null, email: "kpupcebu@gmail.com" },
  "Funbee Cebu Mobile Playground": { address: null, email: "cebuplayground@gmail.com" },
  "INNZ Mobile Playground and Rentals": { address: null, email: "innzmobileplayground@gmail.com" },
  "The Playtime Cebu": { address: "Tisa, Cebu City", email: null },
  "Little Barangay Mobile Party Playpen": { address: null, email: "littlebarangaycebu@gmail.com" },
  "The Little Play Factory": { address: null, email: "thelittleplayfactorycebu@yahoo.com" },

  // ENTERTAINMENT - Souvenirs/Favors
  "Panalangin Crafts": { address: "No. 65 6th Street, Apas, Cebu City", email: null },

  // PHOTOVIDEO
  "X Marks The Spot Photo & Video": { address: null, email: null },

  // COORDINATOR
  "Bliss Unlimited": { address: null, email: "blissunlimited@gmail.com" },

  // LIGHTS/SOUNDS
  "Black Plug Productions": { address: "70-A F. Gochan St, Mabolo, Cebu City", email: "info@blackplugproductions.com" },

  // MOBILE BAR
  "The Alchemy Mobile Bar": { address: null, email: "info@thealchemycebu.com" },

  // STYLING/DECOR
  "Cebu Balloons & Party Supplies": { address: "National Highway, Basak, Mandaue City, 6014", email: "cebuballoons@gmail.com" },
  "Pop Luxury Balloons": { address: null, email: null },

  // FLOWERS
  "Fleur Cebu Inc": { address: "Paseo Arcenas, Banawa, Cebu City", email: "fleurcebu@gmail.com" },

  // RENTALS
  "Ct & T Party Equipment Rentals": { address: "Casuntingan, Mandaue City 6000", email: null },

  // OTHER
  "CEA Creatives and Events": { address: "Stomping Grounds, Pres. Roxas St, Brgy. Kasambagan, Cebu City 6000", email: "info@ceacreatives.com" },
}

const categories = [
  'entertainment', 'catering', 'photo_video', 'hosting', 'band_music',
  'coordinator', 'styling_decor', 'flowers', 'lights_sounds', 'mobile_bar',
  'hair_makeup', 'invites_souvenirs', 'transportation', 'rentals', 'other'
]

let totalUpdated = 0
let totalNull = 0

for (const cat of categories) {
  const filePath = join(dataDir, `${cat}.json`)
  let suppliers
  try {
    suppliers = JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    console.log(`Skipping ${cat}: file not found`)
    continue
  }

  let updated = 0
  let nulled = 0
  for (const s of suppliers) {
    const u = updates[s.business_name]
    if (u) {
      s.address = u.address
      s.email = u.email
      updated++
    } else {
      // Ensure fields exist even if null
      if (!('address' in s)) { s.address = null; nulled++ }
      if (!('email' in s)) { s.email = null; nulled++ }
    }
  }

  writeFileSync(filePath, JSON.stringify(suppliers, null, 2) + '\n')
  console.log(`${cat}.json: ${updated} updated, ${nulled} null-added (${suppliers.length} total)`)
  totalUpdated += updated
  totalNull += nulled
}

console.log(`\nTotal: ${totalUpdated} with research data, ${totalNull} null fields added`)
