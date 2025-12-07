# Genie.ph Next.js Migration - Antigravity Prompts
## Step-by-Step Vibecoding Guide

**Instructions:**
1. Send ONE prompt at a time to Antigravity
2. Wait for completion
3. Run the verification command
4. Only proceed if verification passes
5. If something breaks, tell Antigravity to undo the last change

---

# PHASE 0: PROJECT SETUP
## Estimated Time: 15-20 minutes

---

### Prompt 0.1: Create Fresh Next.js Project
```
Create a new Next.js 15 project in my home directory called "genieph-nextjs-new" with these options:
- TypeScript: Yes
- Tailwind CSS: Yes  
- ESLint: Yes
- App Router: Yes
- src/ directory: Yes
- Import alias: @/*

Run this command:
cd ~ && npx create-next-app@latest genieph-nextjs-new --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

After creation, verify the project structure exists.
```

**Verification:**
```bash
ls ~/genieph-nextjs-new/src/app/layout.tsx && echo "✅ Next.js project created successfully"
```

---

### Prompt 0.2: Install Core Dependencies
```
In the ~/genieph-nextjs-new project, install these dependencies:

Production dependencies:
- @supabase/supabase-js@^2.81.0
- @supabase/ssr
- @tanstack/react-query@^5.90.7
- @google/genai@^1.29.0
- @react-google-maps/api@^2.20.7
- browser-image-compression@^2.0.2
- lodash@^4.17.21
- lodash-es@^4.17.21
- lucide-react@^0.553.0
- react-hot-toast@^2.6.0
- uuid@^13.0.0

Dev dependencies:
- @types/lodash-es@^4.17.12
- @types/uuid

Run:
cd ~/genieph-nextjs-new
npm install @supabase/supabase-js@^2.81.0 @supabase/ssr @tanstack/react-query@^5.90.7 @google/genai@^1.29.0 @react-google-maps/api@^2.20.7 browser-image-compression@^2.0.2 lodash@^4.17.21 lodash-es@^4.17.21 lucide-react@^0.553.0 react-hot-toast@^2.6.0 uuid@^13.0.0
npm install -D @types/lodash-es@^4.17.12 @types/uuid
```

**Verification:**
```bash
cd ~/genieph-nextjs-new && npm list @supabase/ssr && echo "✅ Dependencies installed"
```

---

### Prompt 0.3: Create Environment File
```
Create a .env.local file in ~/genieph-nextjs-new with the environment variables from the original project.

Copy the values from ~/genieph/.env.local but rename the prefixes:
- VITE_SUPABASE_URL → NEXT_PUBLIC_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY → NEXT_PUBLIC_SUPABASE_ANON_KEY
- VITE_GOOGLE_AI_API_KEY → NEXT_PUBLIC_GOOGLE_AI_API_KEY
- VITE_GOOGLE_MAPS_API_KEY → NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

The file should look like:
NEXT_PUBLIC_SUPABASE_URL=https://cqmhanqnfybyxezhobkx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<copy from original>
NEXT_PUBLIC_GOOGLE_AI_API_KEY=<copy from original>
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<copy from original>

Read ~/genieph/.env.local to get the actual values.
```

**Verification:**
```bash
grep "NEXT_PUBLIC_SUPABASE_URL" ~/genieph-nextjs-new/.env.local && echo "✅ Environment file created"
```

---

### Prompt 0.4: Verify Dev Server Starts
```
Start the Next.js development server to verify the base project works:

cd ~/genieph-nextjs-new
npm run dev

The server should start on http://localhost:3000 without errors.
After verifying it works, you can stop the server.
```

**Verification:**
```bash
cd ~/genieph-nextjs-new && npm run build 2>&1 | tail -5
# Should show "✓ Compiled successfully" or similar
```

---

# PHASE 1: CONFIGURATION FILES
## Estimated Time: 10 minutes

---

### Prompt 1.1: Update next.config.ts
```
Replace the contents of ~/genieph-nextjs-new/next.config.ts with this configuration:

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cqmhanqnfybyxezhobkx.supabase.co',
        pathname: '/storage/v1/object/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/sitemap.xml',
        destination: 'https://cqmhanqnfybyxezhobkx.supabase.co/functions/v1/generate-sitemap',
      },
    ]
  },
}

export default nextConfig
```

**Verification:**
```bash
grep "cqmhanqnfybyxezhobkx" ~/genieph-nextjs-new/next.config.ts && echo "✅ next.config.ts updated"
```

---

### Prompt 1.2: Update tsconfig.json
```
Update ~/genieph-nextjs-new/tsconfig.json to ensure these settings exist in compilerOptions:

{
  "compilerOptions": {
    "esModuleInterop": true,
    "allowJs": true,
    "forceConsistentCasingInFileNames": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "supabase/functions/**"]
}

Merge these with the existing tsconfig.json, don't replace everything.
```

**Verification:**
```bash
grep "esModuleInterop" ~/genieph-nextjs-new/tsconfig.json && echo "✅ tsconfig.json updated"
```

---

# PHASE 2: SUPABASE SSR SETUP (CRITICAL)
## Estimated Time: 15 minutes

---

### Prompt 2.1: Create Supabase Browser Client
```
Create the file ~/genieph-nextjs-new/src/lib/supabase/client.ts with this content:

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Backward compatibility export for existing code
export function getSupabaseClient() {
  return createClient()
}

Make sure to create the directory structure if it doesn't exist.
```

**Verification:**
```bash
cat ~/genieph-nextjs-new/src/lib/supabase/client.ts | head -5 && echo "✅ Browser client created"
```

---

### Prompt 2.2: Create Supabase Server Client
```
Create the file ~/genieph-nextjs-new/src/lib/supabase/server.ts with this content:

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component - ignore
          }
        },
      },
    }
  )
}
```

**Verification:**
```bash
grep "createServerClient" ~/genieph-nextjs-new/src/lib/supabase/server.ts && echo "✅ Server client created"
```

---

### Prompt 2.3: Create Middleware for Auth (CRITICAL)
```
Create the file ~/genieph-nextjs-new/middleware.ts (in the PROJECT ROOT, not in src/) with this content:

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not add any logic between createServerClient and getUser()
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

IMPORTANT: This file must be at ~/genieph-nextjs-new/middleware.ts (project root), NOT in src/
```

**Verification:**
```bash
ls ~/genieph-nextjs-new/middleware.ts && grep "supabase.auth.getUser" ~/genieph-nextjs-new/middleware.ts && echo "✅ Middleware created at correct location"
```

---

### Prompt 2.4: Verify Supabase Setup
```
Run a build to verify the Supabase setup has no TypeScript errors:

cd ~/genieph-nextjs-new
npm run build

The build should complete without errors related to Supabase imports.
```

**Verification:**
```bash
cd ~/genieph-nextjs-new && npm run build 2>&1 | grep -i "error" || echo "✅ Build passed - Supabase setup OK"
```

---

# PHASE 3: CONTEXT PROVIDERS (CRITICAL FOR STATE PERSISTENCE)
## Estimated Time: 30-45 minutes

⚠️ **This is the most critical phase.** These contexts replace the Vite SPA's ability to keep state in memory during navigation.

---

### Prompt 3.1: Create AuthContext
```
Create the file ~/genieph-nextjs-new/src/contexts/AuthContext.tsx

This should be a Context Provider that wraps the authentication logic from ~/genieph/src/hooks/useAuth.ts

The file should:
1. Start with 'use client' directive
2. Create AuthContext with createContext
3. Create AuthProvider component that:
   - Uses createClient() from @/lib/supabase/client
   - Has state for: user, session, isLoading
   - Sets up onAuthStateChange listener in useEffect
   - Provides: signIn, signUp, signOut, signInAnonymously functions
4. Export useAuth() hook that uses useContext

Here's the structure:

'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
  signInAnonymously: () => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }, [supabase])

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error }
  }, [supabase])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }, [supabase])

  const signInAnonymously = useCallback(async () => {
    const { error } = await supabase.auth.signInAnonymously()
    return { error }
  }, [supabase])

  const isAuthenticated = !!user && !user.is_anonymous

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      isAuthenticated,
      signIn,
      signUp,
      signOut,
      signInAnonymously,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

**Verification:**
```bash
grep "AuthProvider" ~/genieph-nextjs-new/src/contexts/AuthContext.tsx && grep "'use client'" ~/genieph-nextjs-new/src/contexts/AuthContext.tsx && echo "✅ AuthContext created"
```

---

### Prompt 3.2: Copy Types File
```
Copy the types file from the original project, as we'll need it for the next contexts:

cp ~/genieph/src/types.ts ~/genieph-nextjs-new/src/types.ts

This file should not need any modifications as it contains only type definitions.
```

**Verification:**
```bash
grep "HybridAnalysisResult" ~/genieph-nextjs-new/src/types.ts && echo "✅ Types file copied"
```

---

### Prompt 3.3: Copy Constants File
```
Copy the constants file from the original project:

cp ~/genieph/src/constants.ts ~/genieph-nextjs-new/src/constants.ts
mkdir -p ~/genieph-nextjs-new/src/constants
cp ~/genieph/src/constants/searchKeywords.ts ~/genieph-nextjs-new/src/constants/searchKeywords.ts

These files should not need modifications.
```

**Verification:**
```bash
ls ~/genieph-nextjs-new/src/constants.ts && ls ~/genieph-nextjs-new/src/constants/searchKeywords.ts && echo "✅ Constants copied"
```

---

### Prompt 3.4: Create ImageContext (CRITICAL)
```
Create ~/genieph-nextjs-new/src/contexts/ImageContext.tsx

This is CRITICAL for state persistence. You need to convert the hook from ~/genieph/src/hooks/useImageManagement.ts into a Context Provider.

Steps:
1. Read ~/genieph/src/hooks/useImageManagement.ts completely
2. Create a new file with 'use client' at the top
3. Create ImageContext and ImageProvider
4. Move ALL the state and functions from the hook into the provider
5. Export useImageContext() hook

The structure should be:

'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
// Copy all necessary imports from the original hook

// Copy all interfaces/types from the original hook

interface ImageContextType {
  // Copy all return type properties from the original hook
}

const ImageContext = createContext<ImageContextType | null>(null)

export function ImageProvider({ children }: { children: React.ReactNode }) {
  // PASTE THE ENTIRE BODY OF useImageManagement HERE
  // All useState calls
  // All useRef calls  
  // All useCallback functions
  // All useEffect calls
  
  const value = {
    // All the properties that were returned from the hook
  }

  return (
    <ImageContext.Provider value={value}>
      {children}
    </ImageContext.Provider>
  )
}

export function useImageContext() {
  const context = useContext(ImageContext)
  if (!context) {
    throw new Error('useImageContext must be used within ImageProvider')
  }
  return context
}

// Also export as useImageManagement for backward compatibility
export const useImageManagement = useImageContext

IMPORTANT: 
- Update all imports to use @/ aliases (e.g., '../types' → '@/types')
- Replace any import.meta.env.VITE_* with process.env.NEXT_PUBLIC_*
- The file MUST have 'use client' at the very first line
```

**Verification:**
```bash
grep "ImageProvider" ~/genieph-nextjs-new/src/contexts/ImageContext.tsx && grep "'use client'" ~/genieph-nextjs-new/src/contexts/ImageContext.tsx && echo "✅ ImageContext created"
```

---

### Prompt 3.5: Create CustomizationContext (CRITICAL)
```
Create ~/genieph-nextjs-new/src/contexts/CustomizationContext.tsx

This is CRITICAL for state persistence. Convert ~/genieph/src/hooks/useCakeCustomization.ts into a Context Provider.

Steps:
1. Read ~/genieph/src/hooks/useCakeCustomization.ts completely
2. Create a new file with 'use client' at the top
3. Create CustomizationContext and CustomizationProvider
4. Move ALL the state and functions from the hook into the provider
5. Export useCustomizationContext() hook

The structure should be:

'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
// Copy all necessary imports from the original hook

interface CustomizationContextType {
  // Copy all return type properties from the original hook
}

const CustomizationContext = createContext<CustomizationContextType | null>(null)

export function CustomizationProvider({ children }: { children: React.ReactNode }) {
  // PASTE THE ENTIRE BODY OF useCakeCustomization HERE
  
  const value = {
    // All the properties that were returned from the hook
  }

  return (
    <CustomizationContext.Provider value={value}>
      {children}
    </CustomizationContext.Provider>
  )
}

export function useCustomizationContext() {
  const context = useContext(CustomizationContext)
  if (!context) {
    throw new Error('useCustomizationContext must be used within CustomizationProvider')
  }
  return context
}

// Backward compatibility
export const useCakeCustomization = useCustomizationContext

IMPORTANT:
- Update all imports to use @/ aliases
- Replace import.meta.env.VITE_* with process.env.NEXT_PUBLIC_*
- Must have 'use client' at the very first line
```

**Verification:**
```bash
grep "CustomizationProvider" ~/genieph-nextjs-new/src/contexts/CustomizationContext.tsx && echo "✅ CustomizationContext created"
```

---

### Prompt 3.6: Copy and Update CartContext
```
Copy ~/genieph/src/contexts/CartContext.tsx to ~/genieph-nextjs-new/src/contexts/CartContext.tsx

Then make these updates:
1. Add 'use client' at the very first line if not present
2. Update imports:
   - '../lib/supabase/client' → '@/lib/supabase/client'
   - '../types' → '@/types'
   - Change: import { getSupabaseClient } from '@/lib/supabase/client'
3. Replace any import.meta.env.VITE_* with process.env.NEXT_PUBLIC_*
```

**Verification:**
```bash
grep "'use client'" ~/genieph-nextjs-new/src/contexts/CartContext.tsx && grep "@/lib/supabase/client" ~/genieph-nextjs-new/src/contexts/CartContext.tsx && echo "✅ CartContext updated"
```

---

### Prompt 3.7: Copy and Update GoogleMapsLoaderContext
```
Copy ~/genieph/src/contexts/GoogleMapsLoaderContext.tsx to ~/genieph-nextjs-new/src/contexts/GoogleMapsLoaderContext.tsx

Then make these updates:
1. Add 'use client' at the very first line if not present
2. Replace import.meta.env.VITE_GOOGLE_MAPS_API_KEY with process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
```

**Verification:**
```bash
grep "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" ~/genieph-nextjs-new/src/contexts/GoogleMapsLoaderContext.tsx && echo "✅ GoogleMapsLoaderContext updated"
```

---

### Prompt 3.8: Create Providers Wrapper
```
Create ~/genieph-nextjs-new/src/components/Providers.tsx with this content:

'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/contexts/AuthContext'
import { ImageProvider } from '@/contexts/ImageContext'
import { CustomizationProvider } from '@/contexts/CustomizationContext'
import { CartProvider } from '@/contexts/CartContext'
import { GoogleMapsLoaderProvider } from '@/contexts/GoogleMapsLoaderContext'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ImageProvider>
          <CustomizationProvider>
            <CartProvider>
              <GoogleMapsLoaderProvider>
                {children}
                <Toaster
                  position="bottom-center"
                  toastOptions={{
                    style: {
                      borderRadius: '9999px',
                      background: '#333',
                      color: '#fff',
                      boxShadow: '0 3px 10px rgba(0, 0, 0, 0.2)',
                    },
                  }}
                />
              </GoogleMapsLoaderProvider>
            </CartProvider>
          </CustomizationProvider>
        </ImageProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
```

**Verification:**
```bash
grep "ImageProvider" ~/genieph-nextjs-new/src/components/Providers.tsx && grep "CustomizationProvider" ~/genieph-nextjs-new/src/components/Providers.tsx && echo "✅ Providers wrapper created"
```

---

### Prompt 3.9: Update Root Layout with Providers
```
Update ~/genieph-nextjs-new/src/app/layout.tsx to use the Providers:

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://genie.ph'),
  title: {
    default: 'Genie.ph - AI-Powered Custom Cake Design & Ordering',
    template: '%s | Genie.ph',
  },
  description: 'Design and order custom cakes with AI assistance. Upload any design, customize it, and order from local bakeries.',
  keywords: ['custom cakes', 'cake design', 'AI cake', 'Cebu bakery', 'birthday cake', 'wedding cake'],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://genie.ph',
    siteName: 'Genie.ph',
    title: 'Genie.ph - AI-Powered Custom Cake Design',
    description: 'Design and order custom cakes with AI assistance.',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

**Verification:**
```bash
grep "Providers" ~/genieph-nextjs-new/src/app/layout.tsx && echo "✅ Root layout updated with Providers"
```

---

### Prompt 3.10: Verify Context Setup Builds
```
Run a build to check for any TypeScript errors in the contexts:

cd ~/genieph-nextjs-new
npm run build

If there are errors, they will likely be:
1. Missing imports - fix the import paths
2. Type errors - check the type definitions
3. Missing 'use client' - add it to the top of client components

Report any errors you see so we can fix them.
```

**Verification:**
```bash
cd ~/genieph-nextjs-new && npm run build 2>&1 | grep -i "error" | head -10 || echo "✅ Build passed - Context setup OK"
```

---

# PHASE 4: COPY UTILITY FILES
## Estimated Time: 15 minutes

---

### Prompt 4.1: Copy lib/utils Files
```
Copy all utility files from the original project:

mkdir -p ~/genieph-nextjs-new/src/lib/utils

cp ~/genieph/src/lib/utils/availability.ts ~/genieph-nextjs-new/src/lib/utils/
cp ~/genieph/src/lib/utils/currency.ts ~/genieph-nextjs-new/src/lib/utils/
cp ~/genieph/src/lib/utils/imageOptimization.ts ~/genieph-nextjs-new/src/lib/utils/
cp ~/genieph/src/lib/utils/pricing.ts ~/genieph-nextjs-new/src/lib/utils/
cp ~/genieph/src/lib/utils/timeout.ts ~/genieph-nextjs-new/src/lib/utils/
cp ~/genieph/src/lib/utils/toast.ts ~/genieph-nextjs-new/src/lib/utils/
cp ~/genieph/src/lib/utils/urlHelpers.ts ~/genieph-nextjs-new/src/lib/utils/

After copying, update each file:
1. Replace any import.meta.env.VITE_* with process.env.NEXT_PUBLIC_*
2. Update relative imports to use @/ aliases where appropriate
```

**Verification:**
```bash
ls ~/genieph-nextjs-new/src/lib/utils/*.ts | wc -l | grep -q "7" && echo "✅ All utility files copied"
```

---

### Prompt 4.2: Copy Database Types and QueryClient
```
Copy these additional lib files:

cp ~/genieph/src/lib/database.types.ts ~/genieph-nextjs-new/src/lib/
cp ~/genieph/src/lib/queryClient.ts ~/genieph-nextjs-new/src/lib/

These files typically don't need modifications.
```

**Verification:**
```bash
ls ~/genieph-nextjs-new/src/lib/database.types.ts && ls ~/genieph-nextjs-new/src/lib/queryClient.ts && echo "✅ Database types and queryClient copied"
```

---

### Prompt 4.3: Copy Config Files
```
Copy configuration files:

cp ~/genieph/src/config.ts ~/genieph-nextjs-new/src/

If the file references import.meta.env.VITE_*, update to process.env.NEXT_PUBLIC_*
```

**Verification:**
```bash
ls ~/genieph-nextjs-new/src/config.ts && echo "✅ Config file copied"
```

---

# PHASE 5: COPY SERVICES
## Estimated Time: 20 minutes

---

### Prompt 5.1: Copy All Service Files
```
Copy all service files from the original project:

mkdir -p ~/genieph-nextjs-new/src/services

cp ~/genieph/src/services/accountActivation.ts ~/genieph-nextjs-new/src/services/
cp ~/genieph/src/services/buxService.ts ~/genieph-nextjs-new/src/services/
cp ~/genieph/src/services/designService.ts ~/genieph-nextjs-new/src/services/
cp ~/genieph/src/services/discountService.ts ~/genieph-nextjs-new/src/services/
cp ~/genieph/src/services/geminiService.ts ~/genieph-nextjs-new/src/services/
cp ~/genieph/src/services/incentiveService.ts ~/genieph-nextjs-new/src/services/
cp ~/genieph/src/services/paymentVerificationService.ts ~/genieph-nextjs-new/src/services/
cp ~/genieph/src/services/pricingService.database.ts ~/genieph-nextjs-new/src/services/
cp ~/genieph/src/services/pricingService.ts ~/genieph-nextjs-new/src/services/
cp ~/genieph/src/services/shareService.ts ~/genieph-nextjs-new/src/services/
cp ~/genieph/src/services/supabaseService.ts ~/genieph-nextjs-new/src/services/
cp ~/genieph/src/services/xenditService.ts ~/genieph-nextjs-new/src/services/
```

**Verification:**
```bash
ls ~/genieph-nextjs-new/src/services/*.ts | wc -l
# Should show 12 files
```

---

### Prompt 5.2: Update Service File Imports
```
For each service file in ~/genieph-nextjs-new/src/services/, make these updates:

1. Replace all import.meta.env.VITE_* with process.env.NEXT_PUBLIC_*
2. Update Supabase imports:
   - Change: import { supabase } from '../lib/supabase/client'
   - To: import { createClient, getSupabaseClient } from '@/lib/supabase/client'
3. Update other relative imports to @/ aliases:
   - '../types' → '@/types'
   - '../constants' → '@/constants'
   - '../lib/utils/...' → '@/lib/utils/...'

Do this for ALL service files systematically.
```

**Verification:**
```bash
grep -r "import.meta.env" ~/genieph-nextjs-new/src/services/ || echo "✅ No VITE env vars remaining in services"
```

---

### Prompt 5.3: Copy lib/services
```
Copy the lib/services directory:

mkdir -p ~/genieph-nextjs-new/src/lib/services
cp ~/genieph/src/lib/services/supabaseService.ts ~/genieph-nextjs-new/src/lib/services/

Update the imports in this file as well:
- Replace import.meta.env.VITE_* with process.env.NEXT_PUBLIC_*
- Update Supabase imports
- Update relative imports to @/ aliases
```

**Verification:**
```bash
ls ~/genieph-nextjs-new/src/lib/services/supabaseService.ts && echo "✅ lib/services copied"
```

---

# PHASE 6: COPY COMPONENTS
## Estimated Time: 25 minutes

---

### Prompt 6.1: Copy All Components
```
Copy all component files:

mkdir -p ~/genieph-nextjs-new/src/components/UI

# Copy main components
cp ~/genieph/src/components/*.tsx ~/genieph-nextjs-new/src/components/

# Copy UI subcomponents
cp ~/genieph/src/components/UI/*.tsx ~/genieph-nextjs-new/src/components/UI/
```

**Verification:**
```bash
ls ~/genieph-nextjs-new/src/components/*.tsx | wc -l
# Should show 35+ files
```

---

### Prompt 6.2: Add 'use client' to All Components
```
For EVERY .tsx file in ~/genieph-nextjs-new/src/components/ and ~/genieph-nextjs-new/src/components/UI/:

Add 'use client' as the VERY FIRST LINE of each file (before any imports).

Files to update (check each one):
- AccessoryList.tsx
- AddToCartButton.tsx
- AddressForm.tsx
- BillShareCard.tsx
- CakeBaseOptions.tsx
- CakeMessagesOptions.tsx
- CakeToppersOptions.tsx
- CartDisplay.tsx
- CartItemCard.tsx
- ColorPalette.tsx
- ContributionSuccessModal.tsx
- EnvVarTest.tsx
- ErrorBoundary.tsx
- ErrorFallback.tsx
- FeatureList.tsx
- FloatingImagePreview.tsx
- FloatingResultPanel.tsx
- IcingColorEditor.tsx
- ImageUploader.optimized.tsx
- ImageUploader.tsx
- ImageZoomModal.tsx
- LazyImage.tsx
- LoadingSkeletons.tsx
- LoadingSpinner.tsx
- MultiColorEditor.tsx
- PaymentModeToggle.tsx
- PricingDisplay.tsx
- ReportModal.tsx
- SearchAutocomplete.tsx
- ShareButton.tsx
- ShareModal.tsx
- SplitOrderShareModal.tsx
- SplitWithFriendsModal.tsx
- StickyAddToCartBar.tsx
- TopperCard.tsx
- icons.tsx
- UI/AnimatedBlobs.tsx
- UI/DetailItem.tsx
- And any others present

Also update imports:
- '../lib/' → '@/lib/'
- '../services/' → '@/services/'
- '../types' → '@/types'
- '../constants' → '@/constants'
- '../hooks' → '@/hooks'
- '../contexts/' → '@/contexts/'
```

**Verification:**
```bash
grep -L "'use client'" ~/genieph-nextjs-new/src/components/*.tsx 2>/dev/null | head -5 || echo "✅ All components have 'use client'"
```

---

### Prompt 6.3: Update Component Imports
```
Go through each component file and update the imports to use @/ aliases:

For each file in ~/genieph-nextjs-new/src/components/:
- '../lib/' → '@/lib/'
- '../services/' → '@/services/'
- '../types' → '@/types'
- '../constants' → '@/constants'
- '../hooks' → '@/hooks'
- '../contexts/' → '@/contexts/'
- '../../' style imports should also be updated

Also replace any import.meta.env.VITE_* with process.env.NEXT_PUBLIC_*
```

**Verification:**
```bash
grep -r "from '\.\." ~/genieph-nextjs-new/src/components/*.tsx | grep -v "components/" | head -5 || echo "✅ Component imports updated"
```

---

# PHASE 7: COPY HOOKS (STATELESS ONES)
## Estimated Time: 15 minutes

---

### Prompt 7.1: Copy Stateless Hooks
```
Copy hooks that don't need to be contexts (they don't hold persistent navigation state):

mkdir -p ~/genieph-nextjs-new/src/hooks

cp ~/genieph/src/hooks/useAddresses.ts ~/genieph-nextjs-new/src/hooks/
cp ~/genieph/src/hooks/useAvailabilitySettings.ts ~/genieph-nextjs-new/src/hooks/
cp ~/genieph/src/hooks/useCanonicalUrl.ts ~/genieph-nextjs-new/src/hooks/
cp ~/genieph/src/hooks/useDesignSharing.ts ~/genieph-nextjs-new/src/hooks/
cp ~/genieph/src/hooks/useDesignUpdate.ts ~/genieph-nextjs-new/src/hooks/
cp ~/genieph/src/hooks/useOrders.ts ~/genieph-nextjs-new/src/hooks/
cp ~/genieph/src/hooks/usePricing.ts ~/genieph-nextjs-new/src/hooks/
cp ~/genieph/src/hooks/useSEO.ts ~/genieph-nextjs-new/src/hooks/
cp ~/genieph/src/hooks/useSearchEngine.ts ~/genieph-nextjs-new/src/hooks/
cp ~/genieph/src/hooks/useUserProfile.ts ~/genieph-nextjs-new/src/hooks/

DO NOT COPY:
- useAppNavigation.ts (replaced by Next.js router)
- useAuth.ts (converted to AuthContext)
- useCakeCustomization.ts (converted to CustomizationContext)
- useImageManagement.ts (converted to ImageContext)
```

**Verification:**
```bash
ls ~/genieph-nextjs-new/src/hooks/*.ts | wc -l
# Should show 10 files
```

---

### Prompt 7.2: Update Hook Imports
```
For each hook file in ~/genieph-nextjs-new/src/hooks/:

1. Update imports to use @/ aliases
2. Replace import.meta.env.VITE_* with process.env.NEXT_PUBLIC_*
3. Update Supabase imports to use @/lib/supabase/client
```

**Verification:**
```bash
grep -r "import.meta.env" ~/genieph-nextjs-new/src/hooks/ || echo "✅ No VITE env vars in hooks"
```

---

### Prompt 7.3: Create hooks/index.ts
```
Create ~/genieph-nextjs-new/src/hooks/index.ts to re-export all hooks:

// Re-export from contexts (these were converted)
export { useAuth } from '@/contexts/AuthContext'
export { useImageContext, useImageManagement } from '@/contexts/ImageContext'
export { useCustomizationContext, useCakeCustomization } from '@/contexts/CustomizationContext'

// Export remaining hooks
export { useAddresses } from './useAddresses'
export { useAvailabilitySettings } from './useAvailabilitySettings'
export { useCanonicalUrl } from './useCanonicalUrl'
export { useDesignSharing } from './useDesignSharing'
export { useDesignUpdate } from './useDesignUpdate'
export { useOrders } from './useOrders'
export { usePricing } from './usePricing'
export { useSEO } from './useSEO'
export { useSearchEngine } from './useSearchEngine'
export { useUserProfile } from './useUserProfile'
```

**Verification:**
```bash
grep "useAuth" ~/genieph-nextjs-new/src/hooks/index.ts && grep "useImageContext" ~/genieph-nextjs-new/src/hooks/index.ts && echo "✅ hooks/index.ts created"
```

---

# PHASE 8: BUILD CHECK
## Estimated Time: 10 minutes

---

### Prompt 8.1: Full Build Check
```
Run a full build to identify any remaining issues:

cd ~/genieph-nextjs-new
npm run build

List all errors that appear. Common issues will be:
1. Missing imports - need to fix paths
2. Type errors - check type definitions
3. Missing 'use client' - add to component files
4. Environment variable issues - VITE_ → NEXT_PUBLIC_

Report the errors so we can fix them one by one.
```

**Verification:**
```bash
cd ~/genieph-nextjs-new && npm run build 2>&1 | tail -20
```

---

### Prompt 8.2: Fix Build Errors (Repeat as needed)
```
[Use this prompt template for each error]

The build shows this error:
[PASTE ERROR HERE]

Please fix this error. Common solutions:
- If import not found: update the import path to use @/ alias
- If 'use client' needed: add it to the top of the file
- If type error: check the type definition or add proper typing
- If VITE_ env var: change to NEXT_PUBLIC_

Fix the error and verify the fix works.
```

---

# PHASE 9: CREATE LANDING PAGE
## Estimated Time: 20 minutes

---

### Prompt 9.1: Create Landing Page Server Component
```
Create ~/genieph-nextjs-new/src/app/page.tsx:

import { Metadata } from 'next'
import LandingClient from './LandingClient'

export const metadata: Metadata = {
  title: 'Genie.ph - AI-Powered Custom Cake Design',
  description: 'Design your dream cake with AI. Upload any image, customize colors and decorations, and order from local bakeries.',
}

export default function LandingPage() {
  return <LandingClient />
}
```

**Verification:**
```bash
cat ~/genieph-nextjs-new/src/app/page.tsx && echo "✅ Landing page server component created"
```

---

### Prompt 9.2: Create Landing Page Client Component
```
Create ~/genieph-nextjs-new/src/app/LandingClient.tsx

Copy the content from ~/genieph/src/app/landing/page.tsx and make these changes:

1. Add 'use client' at the very first line
2. Replace setAppState('customizing') calls with:
   import { useRouter } from 'next/navigation'
   const router = useRouter()
   router.push('/customizing')
3. Replace setAppState('about') with router.push('/about')
4. Replace setAppState('cart') with router.push('/cart')
5. etc. for all navigation
6. Update all imports to use @/ aliases
7. Replace useImageManagement() with useImageContext()
8. Replace useCakeCustomization() with useCustomizationContext()

The component should handle image upload and navigate to /customizing when ready.
```

**Verification:**
```bash
grep "'use client'" ~/genieph-nextjs-new/src/app/LandingClient.tsx && grep "useRouter" ~/genieph-nextjs-new/src/app/LandingClient.tsx && echo "✅ Landing client created"
```

---

### Prompt 9.3: Test Landing Page
```
Start the dev server and verify the landing page loads:

cd ~/genieph-nextjs-new
npm run dev

Open http://localhost:3000 in a browser. The landing page should:
1. Display without errors
2. Show the image upload UI
3. Not crash the server

Report any console errors or issues.
```

**Verification:**
```bash
cd ~/genieph-nextjs-new && timeout 10 npm run dev 2>&1 | grep -i "error" | head -5 || echo "✅ Dev server starts"
```

---

# PHASE 10: CREATE CUSTOMIZING PAGE (CRITICAL TEST)
## Estimated Time: 30 minutes

---

### Prompt 10.1: Create Customizing Page Server Component
```
Create ~/genieph-nextjs-new/src/app/customizing/page.tsx:

import { Metadata } from 'next'
import CustomizingClient from './CustomizingClient'

export const metadata: Metadata = {
  title: 'Customize Your Cake',
  description: 'Customize your cake design with AI-powered suggestions.',
}

export default function CustomizingPage() {
  return <CustomizingClient />
}
```

**Verification:**
```bash
cat ~/genieph-nextjs-new/src/app/customizing/page.tsx && echo "✅ Customizing page created"
```

---

### Prompt 10.2: Create Customizing Page Client Component
```
Create ~/genieph-nextjs-new/src/app/customizing/CustomizingClient.tsx

Copy the content from ~/genieph/src/app/customizing/page.tsx and make these changes:

1. Add 'use client' at the very first line
2. Replace useImageManagement() with useImageContext() from @/contexts/ImageContext
3. Replace useCakeCustomization() with useCustomizationContext() from @/contexts/CustomizationContext
4. Replace all setAppState() calls with router.push() using useRouter from next/navigation
5. Add a redirect check at the top of the component:

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useImageContext } from '@/contexts/ImageContext'
import { useCustomizationContext } from '@/contexts/CustomizationContext'

export default function CustomizingClient() {
  const router = useRouter()
  const { originalImageData } = useImageContext()
  const { isAnalyzing } = useCustomizationContext()
  
  // Redirect to home if no image data
  useEffect(() => {
    if (!originalImageData && !isAnalyzing) {
      router.replace('/')
    }
  }, [originalImageData, isAnalyzing, router])

  // ... rest of the component

6. Update all imports to use @/ aliases
```

**Verification:**
```bash
grep "useImageContext" ~/genieph-nextjs-new/src/app/customizing/CustomizingClient.tsx && grep "useCustomizationContext" ~/genieph-nextjs-new/src/app/customizing/CustomizingClient.tsx && echo "✅ Customizing client uses contexts"
```

---

### Prompt 10.3: Test State Persistence (CRITICAL)
```
This is the CRITICAL test for state persistence.

1. Start the dev server: npm run dev
2. Go to http://localhost:3000 (landing page)
3. Upload a cake image
4. The app should navigate to /customizing
5. The uploaded image should be visible on the customizing page
6. Refresh the page - the image might be lost (that's OK for now)

If the image is NOT visible after navigation (without refresh), there's a bug in the context setup.

Report what happens:
- Does the navigation work?
- Is the image visible after navigation?
- Are there any console errors?
```

---

# PHASE 11: CREATE SHARED DESIGN PAGE (SEO CRITICAL)
## Estimated Time: 25 minutes

---

### Prompt 11.1: Create Dynamic Route Directory
```
Create the directory structure for the shared design page:

mkdir -p ~/genieph-nextjs-new/src/app/designs/[slug]
```

**Verification:**
```bash
ls -d ~/genieph-nextjs-new/src/app/designs/[slug] && echo "✅ Directory created"
```

---

### Prompt 11.2: Create Shared Design Server Component with Metadata
```
Create ~/genieph-nextjs-new/src/app/designs/[slug]/page.tsx:

import { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SharedDesignClient from './SharedDesignClient'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  
  const { data: design } = await supabase
    .from('cakegenie_shared_designs')
    .select('title, description, alt_text, customized_image_url, cake_type, cake_size, final_price')
    .eq('url_slug', slug)
    .single()

  if (!design) {
    return { title: 'Design Not Found' }
  }

  return {
    title: design.title || 'Custom Cake Design',
    description: design.description || 'A beautiful custom cake design created with Genie.ph',
    openGraph: {
      title: design.title || 'Custom Cake Design',
      description: design.description || 'A beautiful custom cake design',
      images: [
        {
          url: design.customized_image_url,
          width: 1200,
          height: 630,
          alt: design.alt_text || 'Custom cake design',
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: design.title || 'Custom Cake Design',
      description: design.description || 'A beautiful custom cake design',
      images: [design.customized_image_url],
    },
  }
}

export default async function SharedDesignPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  
  const { data: design } = await supabase
    .from('cakegenie_shared_designs')
    .select('*')
    .eq('url_slug', slug)
    .single()

  if (!design) {
    notFound()
  }

  return <SharedDesignClient design={design} />
}
```

**Verification:**
```bash
grep "generateMetadata" ~/genieph-nextjs-new/src/app/designs/\\[slug\\]/page.tsx && echo "✅ Metadata generation created"
```

---

### Prompt 11.3: Create Shared Design Client Component
```
Create ~/genieph-nextjs-new/src/app/designs/[slug]/SharedDesignClient.tsx

Copy content from ~/genieph/src/app/design/page.tsx but with these changes:

1. Add 'use client' at the very first line
2. Accept 'design' as a prop instead of fetching it:

'use client'

import { useRouter } from 'next/navigation'
// ... other imports

interface SharedDesignClientProps {
  design: any // You can create a proper type later
}

export default function SharedDesignClient({ design }: SharedDesignClientProps) {
  const router = useRouter()
  
  // Remove the data fetching logic - data comes from props
  // Keep all the interactive UI logic
  
  // ... rest of the component
}

3. Replace setAppState() calls with router.push()
4. Update all imports to use @/ aliases
5. Remove any useEffect that fetches the design data
```

**Verification:**
```bash
grep "'use client'" ~/genieph-nextjs-new/src/app/designs/\\[slug\\]/SharedDesignClient.tsx && grep "design" ~/genieph-nextjs-new/src/app/designs/\\[slug\\]/SharedDesignClient.tsx && echo "✅ SharedDesignClient created"
```

---

### Prompt 11.4: Test SEO (CRITICAL)
```
Test that the shared design page has proper SEO metadata:

1. Find an existing design slug from your database
2. Run: curl -s http://localhost:3000/designs/[slug] | grep "og:image"
3. Or view the page source in a browser

The HTML should contain:
- <meta property="og:title" content="...">
- <meta property="og:description" content="...">
- <meta property="og:image" content="...">

This is what makes social sharing work properly!
```

---

# PHASE 12: CREATE REMAINING PAGES
## Estimated Time: Variable

Use this template for each remaining page:

---

### Prompt Template: Create [Page Name] Page
```
Create the [page name] page:

1. Create ~/genieph-nextjs-new/src/app/[route]/page.tsx (Server Component):

import { Metadata } from 'next'
import [PageName]Client from './[PageName]Client'

export const metadata: Metadata = {
  title: '[Page Title]',
  description: '[Page description]',
}

export default function [PageName]Page() {
  return <[PageName]Client />
}

2. Create ~/genieph-nextjs-new/src/app/[route]/[PageName]Client.tsx (Client Component):

Copy from ~/genieph/src/app/[original-route]/page.tsx
- Add 'use client' at the top
- Replace setAppState() with router.push()
- Update imports to @/ aliases
- Replace hook calls with context calls where needed
```

---

## Pages to Create (in order of importance):

1. `/cart` - Cart page
2. `/about` - About page
3. `/contact` - Contact page
4. `/how-to-order` - How to order page
5. `/reviews` - Reviews page
6. `/checkout` - Checkout page
7. `/order-confirmation` - Order confirmation page
8. `/login` - Login page (in (auth) group)
9. `/signup` - Signup page (in (auth) group)
10. `/account/addresses` - Addresses page
11. `/account/orders` - Orders page
12. `/contribute` - Contribution page
13. `/auth/set-password` - Set password page
14. `/not-found` - 404 page

---

# PHASE 13: LEGACY HASH REDIRECT
## Estimated Time: 10 minutes

---

### Prompt 13.1: Create Hash Redirect Component
```
Create ~/genieph-nextjs-new/src/components/ClientHashRedirect.tsx:

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ClientHashRedirect() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash || hash === '#') return

    const path = hash.substring(1) // Remove the #
    if (!path.startsWith('/')) return

    console.log(`[HashRedirect] Redirecting: ${hash} → ${path}`)

    // Design routes
    const designMatch = path.match(/^\\/designs?\\/([a-z0-9-]+)\\/?$/i)
    if (designMatch) {
      router.replace(`/designs/${designMatch[1]}`)
      return
    }

    // Static routes
    const staticRoutes = ['/about', '/contact', '/how-to-order', '/reviews', '/cart', '/customizing']
    for (const route of staticRoutes) {
      if (path === route || path.startsWith(route + '/')) {
        router.replace(path)
        return
      }
    }

    // Discount codes (alphanumeric at root like /#/FRIEND100)
    const discountMatch = path.match(/^\\/([A-Za-z0-9]{3,20})\\/?$/i)
    if (discountMatch) {
      router.replace(`/?discount=${discountMatch[1].toUpperCase()}`)
      return
    }
  }, [router])

  return null
}
```

**Verification:**
```bash
grep "HashRedirect" ~/genieph-nextjs-new/src/components/ClientHashRedirect.tsx && echo "✅ Hash redirect component created"
```

---

### Prompt 13.2: Add Hash Redirect to Layout
```
Update ~/genieph-nextjs-new/src/app/layout.tsx to include the hash redirect:

Add this import:
import ClientHashRedirect from '@/components/ClientHashRedirect'

Add <ClientHashRedirect /> inside the <Providers> wrapper:

<Providers>
  <ClientHashRedirect />
  {children}
</Providers>
```

**Verification:**
```bash
grep "ClientHashRedirect" ~/genieph-nextjs-new/src/app/layout.tsx && echo "✅ Hash redirect added to layout"
```

---

# PHASE 14: FINAL TESTING
## Estimated Time: 30 minutes

---

### Prompt 14.1: Full Build Test
```
Run a production build:

cd ~/genieph-nextjs-new
npm run build

This should complete without errors. Report any errors that appear.
```

---

### Prompt 14.2: Functional Testing Checklist
```
Test each of these scenarios:

1. Landing Page:
   - [ ] Page loads without errors
   - [ ] Image upload button works
   - [ ] Uploading image navigates to /customizing

2. State Persistence:
   - [ ] Upload image on landing
   - [ ] Navigate to /customizing
   - [ ] Image is visible (not lost!)
   - [ ] Customization options work

3. SEO Test:
   - [ ] Visit /designs/[slug]
   - [ ] View page source
   - [ ] og:image meta tag is present
   - [ ] og:title meta tag has actual title (not generic)

4. Legacy Hash Redirect:
   - [ ] Visit /#/designs/[slug]
   - [ ] Redirects to /designs/[slug]
   - [ ] Visit /#/about
   - [ ] Redirects to /about

5. Cart Flow:
   - [ ] Add item to cart
   - [ ] Navigate to /cart
   - [ ] Item is present

6. Auth Flow:
   - [ ] Login page works
   - [ ] Can sign in
   - [ ] Session persists across pages

Report any failures!
```

---

# ROLLBACK INSTRUCTIONS

If something goes wrong at any step:

### To Undo the Last Change:
```
Tell Antigravity: "Undo the last change you made"
```

### To Start Fresh:
```
rm -rf ~/genieph-nextjs-new
# Then start from Prompt 0.1
```

### To Compare with Original:
```
The original Vite project is at ~/genieph
You can reference it anytime for the correct implementation
```

---

# SUCCESS CRITERIA

The migration is complete when:

1. ✅ `npm run build` passes without errors
2. ✅ Landing page loads and image upload works
3. ✅ State persists when navigating Landing → Customizing
4. ✅ /designs/[slug] has proper OG meta tags in HTML source
5. ✅ Legacy hash URLs redirect correctly
6. ✅ Auth flow works (login, logout, session refresh)
7. ✅ Cart persists items across pages
8. ✅ All pages render without errors

---

# QUICK REFERENCE

## Key File Locations

| Purpose | Path |
|---------|------|
| Root Layout | `src/app/layout.tsx` |
| Middleware | `middleware.ts` (root!) |
| Supabase Browser | `src/lib/supabase/client.ts` |
| Supabase Server | `src/lib/supabase/server.ts` |
| All Contexts | `src/contexts/*.tsx` |
| Providers Wrapper | `src/components/Providers.tsx` |

## Common Fixes

| Error | Solution |
|-------|----------|
| "needs useState" | Add `'use client'` to file |
| "import.meta.env" | Change to `process.env.NEXT_PUBLIC_*` |
| "Cannot find module" | Update import to `@/...` |
| "useRouter not found" | Import from `next/navigation` |
| State lost on nav | Use Context instead of hook |
