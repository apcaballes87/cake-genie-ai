# ARCHITECTURE OVERVIEW

This document provides an overview of the Cake Genie application's architecture. It helps developers understand the project structure, core components, and key design decisions.

## 1. PROJECT STRUCTURE

The project is a client-side Single Page Application (SPA) built with React. It follows a feature-oriented structure, primarily organized by hooks, components, and services. There is no separate backend repository; it utilizes a Backend-as-a-Service (BaaS) model.

```
[Project Root]/
├── app/                      # Page components, organized by view/route
│   ├── (auth)/               # Authentication-related pages
│   ├── account/              # User account pages (orders, addresses)
│   └── ...                   # Other top-level pages (cart, customizing, etc.)
│
├── components/               # Reusable React UI components
│   ├── UI/                   # General-purpose, stylistic UI components
│   └── ...                   # Feature-specific components
│
├── constants/                # Application-wide constants (colors, keywords, etc.)
├── contexts/                 # React Context providers (e.g., CartContext)
├── hooks/                    # Custom hooks containing business logic
├── lib/                      # Core libraries and utilities
│   ├── supabase/             # Supabase client setup
│   ├── utils/                # General utility functions
│   └── queryClient.ts        # TanStack Query client configuration
│
├── services/                 # Modules for interacting with external APIs and services
├── types.ts                  # Shared TypeScript type definitions
├── App.tsx                   # Main application component, handles routing and state orchestration
├── config.ts                 # Configuration file for Supabase credentials
├── index.html                # Main HTML entry point with import maps
└── index.tsx                 # React application root
```

## 2. HIGH-LEVEL SYSTEM DIAGRAM

The application employs a serverless architecture, with the frontend client directly interacting with various cloud services.

```
[User] <--> [React SPA (Browser)] <--+
                 |                   |
                 +-----------------> [Google Gemini API] (For AI analysis & image generation)
                 |                   |
                 +-----------------> [Supabase] (BaaS)
                                       |
                                       +--> [Auth]
                                       |
                                       +--> [PostgreSQL Database] (Orders, Users, Cart, etc.)
                                       |
                                       +--> [Storage] (Cake Images)
```

**Data Flow:**
1.  **User Interaction:** The user interacts with the React application in their browser.
2.  **AI Features:** For cake analysis or design generation, the client makes secure API calls directly to the Google Gemini API.
3.  **Data & Auth:** The client communicates with Supabase for:
    *   **Authentication:** User sign-up, login (including anonymous sessions).
    *   **Database:** CRUD operations for cart items, orders, user addresses, shared designs, etc.
    *   **Storage:** Uploading and retrieving user-generated cake images.

## 3. CORE COMPONENTS

-   **Frontend Application**: A React SPA that handles all user interface and interactions. It's built with TypeScript and styled with Tailwind CSS. A key feature is its use of browser-native **import maps**, eliminating the need for a traditional bundling step during development.

-   **Routing**: A custom, state-based routing mechanism managed within `App.tsx`. The `appState` variable determines which "page" component from the `app/` directory is rendered.

-   **State Management**:
    *   **UI State:** Managed by React's `useState`, `useReducer`, and custom hooks.
    *   **Shared State:** React Context API is used for global state like the shopping cart (`CartContext`).
    *   **Server State:** **TanStack Query** is used to manage server state, including caching, refetching, and synchronization of data from Supabase.

-   **Business Logic Abstraction**: The `hooks/` directory is central to the architecture. Custom hooks encapsulate specific domains of business logic (e.g., `usePricing`, `useImageManagement`, `useAuth`), keeping `App.tsx` and UI components cleaner and focused on orchestration and presentation.

-   **Backend-as-a-Service (BaaS)**: **Supabase** provides the entire backend infrastructure, including authentication, a PostgreSQL database, and file storage. The frontend interacts with it via the Supabase client library.

-   **AI Service**: The **Google Gemini API** is used for the core AI functionalities:
    *   **Vision Analysis:** Analyzing user-uploaded cake images to identify features.
    *   **Image Generation:** Creating customized cake images based on user modifications.

## 4. KEY DECISIONS & PATTERNS

-   **Serverless Architecture**: The decision to use Supabase as a BaaS and call Gemini directly from the client simplifies development and deployment by eliminating the need to build and maintain a custom backend server. This is well-suited for rapid prototyping and modern frontend-heavy applications.

-   **Hook-Driven Architecture**: Business logic is heavily decoupled from the UI through custom hooks. This improves modularity, testability, and reusability of code. For example, `usePricing` contains all logic for price calculation, independent of how the price is displayed.

-   **Optimistic UI Updates**: The cart (`CartContext`) uses optimistic updates for adding/removing items. This provides a fast and responsive user experience by updating the UI immediately, before the server has confirmed the change.

-   **Buildless Development with Import Maps**: The use of an `importmap` in `index.html` allows the browser to resolve module specifiers like `react` or `@google/genai` directly to CDN URLs. This simplifies the local development setup, as no bundler (like Webpack or Vite) is strictly necessary to run the application.

-   **Single-Component Router**: `App.tsx` acts as a central controller, using a `switch` statement on `appState` to render different page components. While simple, this approach might become difficult to manage as the application grows compared to a library like React Router.

## 5. GETTING STARTED

1.  **Configure Credentials**:
    *   **Supabase**: Open `config.ts` and replace the placeholder values for `SUPABASE_URL` and `SUPABASE_ANON_KEY` with your project's credentials.
    *   **Gemini API**: The application expects the Gemini API key to be available as `process.env.API_KEY`. In the development environment where this app is intended to run (like AI Studio), this is typically configured externally.

2.  **Run the Application**: Since there is no build step, you only need to serve the project files with a simple static file server.
    ```bash
    # If you have Node.js and serve installed
    npm install -g serve
    serve .
    ```
    Then, open your browser to the provided local URL.
