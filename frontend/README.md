# Rehearse Frontend

Modern React application for AI-powered interview practice.

## Tech Stack

- **React 19** - Latest React with new features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS v3** - Utility-first CSS framework
- **React Router** - Client-side routing
- **TanStack Query** - Powerful data fetching and caching
- **Axios** - HTTP client
- **Zustand** - Lightweight state management
- **Lucide React** - Beautiful icon library

## Project Structure

```
frontend/
├── src/
│   ├── pages/           # Page components
│   │   ├── Landing.tsx
│   │   ├── Dashboard.tsx
│   │   ├── InterviewSetup.tsx
│   │   ├── InterviewSession.tsx
│   │   └── Analytics.tsx
│   ├── components/      # Reusable components
│   ├── lib/            # Utilities and API client
│   │   ├── api.ts      # Backend API client
│   │   └── utils.ts    # Helper functions
│   ├── hooks/          # Custom React hooks
│   ├── types/          # TypeScript type definitions
│   ├── App.tsx         # Root component with routing
│   ├── main.tsx        # Application entry point
│   └── index.css       # Global styles with Tailwind
├── public/             # Static assets
├── index.html          # HTML template
└── vite.config.ts      # Vite configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ or compatible runtime
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Create environment file
cp .env.example .env.local

# Update .env.local with your API URL
```

### Development

```bash
# Start development server (default port 5173)
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Environment Variables

Create a `.env.local` file with:

```env
VITE_API_URL=http://localhost:8787
```

For production, update to your deployed backend URL.

## Features

### Landing Page
- Hero section with call-to-action
- Feature highlights
- Professional design

### Dashboard
- Interview session overview
- Quick stats
- Start new interview

### Interview Setup
- Configure duration (15/30/60 minutes)
- Choose mode (Practice/Graded)
- Select AI personas

### Interview Session
- Live interview interface
- Audio recording controls
- Real-time question display
- Persona information

### Analytics
- Overall performance score
- Detailed metrics (Confidence, Clarity, Relevance)
- Strengths and improvements
- Visual score breakdowns

## API Integration

The app communicates with the Rehearse backend API. See `src/lib/api.ts` for all available endpoints:

- `createInterview` - Create new interview session
- `startSession` - Start interview
- `generateQuestion` - Get next question
- `submitResponse` - Submit answer
- `endSession` - Complete session
- `getSessionAnalytics` - View results

## Deployment to Cloudflare Pages

The app is configured for easy deployment to Cloudflare Pages.

### Automatic Deployment (Recommended)

1. **Connect Repository**:
   - Go to [Cloudflare Pages Dashboard](https://dash.cloudflare.com/)
   - Click "Create a project" → "Connect to Git"
   - Select your repository

2. **Configure Build Settings**:
   ```
   Build command:    pnpm build
   Build output:     dist
   Root directory:   frontend
   ```

3. **Set Environment Variables**:
   - Add `VITE_API_URL` with your deployed backend URL
   - Example: `https://your-rehearse-api.workers.dev`

4. **Deploy**:
   - Click "Save and Deploy"
   - Your site will be live at `https://your-project.pages.dev`

### Manual Deployment

```bash
# Build the project
pnpm build

# Install Wrangler CLI
npm install -g wrangler

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=rehearse-frontend

# Set environment variable
wrangler pages deployment create production --env VITE_API_URL=https://your-api-url
```

### Custom Domain

In Cloudflare Pages dashboard:
1. Go to your project → Custom domains
2. Add your domain
3. Follow DNS configuration instructions

### Important Notes

- The `public/_redirects` file ensures client-side routing works correctly
- All routes redirect to index.html for React Router to handle
- Environment variables must be prefixed with `VITE_` to be exposed to the app

## Next Steps

1. **Add Authentication**:
   - Integrate WorkOS or similar auth provider
   - Protect routes requiring authentication
   - Store user context

2. **Enhance Features**:
   - Speech-to-text integration for audio responses
   - Document upload for resume analysis
   - Historical session data and trends
   - Progress tracking charts

3. **Optimization**:
   - Code splitting for better performance
   - Image optimization
   - Add service worker for offline support

## Development Commands

```bash
# Type checking
pnpm run type-check

# Linting
pnpm run lint

# Format code
pnpm run format
```

## Contributing

When adding new features:
1. Create components in `src/components/`
2. Add API methods to `src/lib/api.ts`
3. Use TypeScript for type safety
4. Follow existing code style
5. Test thoroughly before committing

## License

See main project LICENSE file.
