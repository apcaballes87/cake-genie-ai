# Cake Genie - AI-Powered Cake Design Application

Cake Genie is a cutting-edge web application that allows users to create custom cake designs using AI technology. Users can upload images, customize cakes with various toppings and designs, and place orders seamlessly.

## Features

- AI-powered image analysis for cake design suggestions
- Interactive cake customization interface
- Real-time pricing calculations
- Shopping cart functionality with Supabase integration
- Social sharing capabilities
- Responsive design for all devices

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **State Management**: React Context API, TanStack Query
- **UI Framework**: Tailwind CSS
- **Backend**: Supabase (Database, Authentication, Storage)
- **AI Integration**: Google Gemini API
- **Maps**: Google Maps API
- **Image Processing**: Browser Image Compression
- **Deployment**: Vercel

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v16 or higher)
- npm or yarn
- A Supabase account
- Google Cloud Platform account for Gemini API
- Google Cloud Platform account for Maps API

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Google Gemini API Key
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Google Maps API Key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Supabase Service Role Key (for server-side operations)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/cake-genie.git
   cd cake-genie
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables as described above

4. Start the development server:
   ```bash
   npm run dev
   ```

## Available Scripts

- `npm run dev` - Starts the development server
- `npm run build` - Builds the application for production
- `npm run preview` - Previews the production build locally
- `npm run start` - Serves the production build

## Project Structure

```
cake-genie/
├── src/
│   ├── app/              # Page components
│   ├── components/       # Reusable UI components
│   ├── contexts/         # React context providers
│   ├── hooks/            # Custom hooks
│   ├── lib/              # Utility functions and services
│   ├── services/         # Business logic services
│   ├── constants/        # Application constants
│   ├── types/            # TypeScript types
│   ├── App.tsx           # Main application component
│   └── index.tsx         # Entry point
├── public/               # Static assets
├── supabase/             # Supabase functions and migrations
├── .env.example          # Environment variable template
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Project dependencies and scripts
```

## Deployment

This application is configured for deployment on Vercel:

1. Push your code to a GitHub repository
2. Connect your repository to Vercel
3. Set the environment variables in Vercel dashboard
4. Deploy!

## Development Guidelines

- Use TypeScript for all new code
- Follow the existing component structure and naming conventions
- Write tests for complex logic
- Use the provided hooks for business logic
- Maintain responsive design principles

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

## License

This project is licensed under the MIT License.