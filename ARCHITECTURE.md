# ARCHITECTURE OVERVIEW

This document provides an overview of the Cake Genie application's architecture. It helps developers understand the project structure, core components, and key design decisions.

## 1. PROJECT STRUCTURE

The project is a **Next.js 14+ application** using the **App Router**. It follows a hybrid SSR/CSR model with React Server Components (RSC) for data fetching and Client Components for interactivity.

```
src/
├── app/                      # Next.js App Router pages & layouts
│   ├── layout.tsx            # Root layout (fonts, metadata, Providers, scripts)
│   ├── page.tsx              # Homepage
│   ├── (auth)/               # Auth routes (login, signup, forgot-password)
│   ├── account/              # User account pages
│   ├── shop/                 # Merchant pages ([merchantSlug]/page.tsx)
│   ├── customizing/          # AI cake customization flow
│   └── ...                   # Other feature routes
│
├── components/               # Reusable React components
│   ├── Providers.tsx         # Client-side context providers wrapper
│   ├── UI/                   # General UI components
│   └── ...                   # Feature-specific components
│
├── contexts/                 # React Context providers
│   ├── AuthContext.tsx       # Authentication state
│   ├── CartContext.tsx       # Shopping cart
│   ├── CustomizationContext.tsx
│   └── ...
│
├── hooks/                    # Custom React hooks (business logic)
├── services/                 # API interaction modules
│   ├── supabaseService.ts    # Supabase database operations
│   ├── geminiService.ts      # Google Gemini AI integration
│   ├── pricingService.ts     # Price calculation logic
│   └── ...
│
├── lib/                      # Core utilities
│   └── supabase/             # Supabase client (browser & server)
│
├── constants/                # Application constants
└── types.ts                  # Shared TypeScript types
```

## 2. SSR vs CSR SPLIT

- **Server Components (default)**: Route pages (`page.tsx`) fetch data server-side using async functions. Metadata generation (`generateMetadata`) runs on the server for SEO.
- **Client Components**: Marked with `'use client'`. Used for interactivity (forms, state, effects). Contexts and hooks live in client components.
- **Example pattern**: `shop/[merchantSlug]/page.tsx` (Server) fetches merchant data, then renders `MerchantPageClient` (Client) for interactive UI.

## 3. LAYOUT & PROVIDERS

### Root Layout (`src/app/layout.tsx`)

- Sets global metadata, fonts (Inter via `next/font`), and base styling.
- Wraps children in `<Providers>` for client-side state.
- Includes analytics scripts (Google Analytics, Microsoft Clarity).

### Providers (`src/components/Providers.tsx`)

A client component that nests context providers:

- `QueryClientProvider` (TanStack Query)
- `AuthProvider`, `CartProvider`, `ImageProvider`, `CustomizationProvider`, `SavedItemsProvider`, `GoogleMapsLoaderProvider`
- `Toaster` (react-hot-toast)

## 4. SUPABASE INTEGRATION

- **Client-side**: `@supabase/ssr` browser client for auth and data access.
- **Server-side**: Server client for RSC data fetching with cookies.
- **Auth**: Email/password, anonymous sessions. Managed via `AuthContext`.
- **Database**: PostgreSQL (orders, users, cart, merchants, products).
- **Storage**: Cake images, user uploads.

## 5. KEY SERVICES

| Service | Purpose |
|---------|---------|
| `supabaseService.ts` | CRUD operations for merchants, products, orders |
| `geminiService.ts` | AI cake analysis & image generation |
| `pricingService.ts` | Calculates cake pricing from analysis |
| `shareService.ts` | Share design links |

## 6. KEY DECISIONS & PATTERNS

- **Next.js App Router**: File-based routing with nested layouts. SSR for SEO-critical pages, CSR for interactive features.
- **Hook-Driven Logic**: Business logic encapsulated in `hooks/` (e.g., `usePricing`, `useAuth`).
- **TanStack Query**: Server state management with caching and background refetching.
- **Optimistic UI**: Cart updates reflect immediately before server confirmation.
- **Serverless Architecture**: Supabase BaaS + Gemini API; no custom backend.

## 7. GETTING STARTED

1. **Install dependencies**: `npm install`
2. **Environment variables**: Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY`
3. **Run dev server**: `npm run dev`
