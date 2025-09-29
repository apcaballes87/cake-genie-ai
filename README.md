<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Cake Genie 🎂✨

An AI-powered cake design application that allows users to upload cake images, customize them with AI assistance, and get instant pricing estimates.

## Features

- 🎨 **AI-Powered Design**: Upload any cake image and let AI suggest customizations
- 🔍 **Image Search**: Search for cake designs directly from the app
- 🎚️ **Customization Tools**: Modify colors, add toppers, change flavors, and more
- 💰 **Instant Pricing**: Get real-time pricing based on your customizations
- 📱 **Responsive Design**: Works on all devices

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite
- **AI Integration**: Google Gemini API
- **Backend**: Supabase (Storage & Database)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Google Gemini API Key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/cake-genie.git
   ```

2. Install dependencies:
   ```bash
   cd cake-genie
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Configure environment variables in Vercel project settings
4. Add your domain in the Vercel dashboard

## Environment Variables

For deployment, you'll need to set the following environment variables:

- `GEMINI_API_KEY` - Your Google Gemini API key

Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/).

## Project Structure

```
cake-genie/
├── components/        # React components
├── services/          # API services and business logic
├── App.tsx           # Main application component
├── index.html        # HTML entry point
├── vite.config.ts    # Vite configuration
└── ...
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Google Gemini for AI capabilities
- Supabase for backend services
- Vercel for deployment platform