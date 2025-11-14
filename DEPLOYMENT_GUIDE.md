# Rehearse Application Deployment Guide

## Architecture Overview

Your Rehearse application uses a modern, scalable, multi-cloud architecture:

```
┌─────────────────────┐
│   User Browsers     │
└──────────┬──────────┘
           │
     ┌─────┴──────┐
     │            │
┌────▼────┐   ┌──▼────────┐
│ Netlify │   │   Vultr   │
│ (Main   │   │  (Admin   │
│  App)   │   │  Panel)   │
└────┬────┘   └──┬────────┘
     │           │
     └─────┬─────┘
           │
    ┌──────▼──────┐
    │  Raindrop   │
    │  Backend    │
    │  (API)      │
    └─────────────┘
```

### Components:

1. **Main Frontend** (Netlify)
   - User-facing React application
   - Interview practice interface
   - Session management and analytics

2. **Admin Panel** (Vultr)
   - Separate admin dashboard
   - Database management
   - System monitoring

3. **Backend API** (Raindrop/CloudflareWorkers)
   - RESTful API
   - SmartBucket for documents
   - SmartSQL for database
   - SmartMemory for AI context

## Current Deployment Status

### ✅ Completed:
- [x] Backend API deployed to Raindrop
- [x] Database schema and seed data
- [x] Frontend built for production
- [x] API URL configured: `https://rehearse-api.01k8kpv1gr6b34n7ftxj2whn2x.lmapp.run`

### ⏳ Pending:
- [ ] Deploy frontend to Netlify
- [ ] Build admin dashboard
- [ ] Deploy admin panel to Vultr
- [ ] Configure CORS

---

## Step 1: Deploy Frontend to Netlify

### Option A: Using Netlify CLI (Manual Deploy)

```bash
# Navigate to frontend directory
cd frontend

# Deploy to Netlify
netlify deploy --prod

# Follow the prompts:
# 1. Authorize Netlify CLI (opens browser)
# 2. Select "Create & configure a new site"
# 3. Choose your team
# 4. Enter site name (e.g., "rehearse-app")
# 5. Publish directory: dist
```

### Option B: Connect Git Repository (Recommended)

1. **Push code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Rehearse application"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Connect to Netlify:**
   - Go to [Netlify Dashboard](https://app.netlify.com/)
   - Click "Add new site" → "Import an existing project"
   - Choose your Git provider (GitHub)
   - Select the `rehearse` repository
   - Configure build settings:
     - **Base directory**: `frontend`
     - **Build command**: `pnpm build`
     - **Publish directory**: `frontend/dist`
     - **Node version**: 18

3. **Deploy:**
   - Click "Deploy site"
   - Netlify will automatically build and deploy
   - Your site will be live at `https://<random-name>.netlify.app`

4. **Optional: Custom Domain:**
   - Go to Site settings → Domain management
   - Click "Add custom domain"
   - Follow DNS configuration instructions

---

## Step 2: Build Admin Dashboard

The admin dashboard is a separate React application that will be deployed to Vultr.

### Features to Include:
- Database management (view/edit personas, plans)
- User management
- Session monitoring
- Analytics dashboard
- System diagnostics

**Status**: Ready to build. Would you like me to create the admin dashboard now?

---

## Step 3: Deploy Admin Panel to Vultr

### Prerequisites:
- Vultr account
- SSH key configured

### Deployment Options:

#### Option A: Vultr Static Site (Simple)
1. Build the admin app: `cd admin && pnpm build`
2. Upload `dist` folder to Vultr Object Storage
3. Configure static site hosting

#### Option B: Vultr Compute Instance (Full Control)
1. Create a Vultr compute instance (Ubuntu 22.04)
2. Install Node.js and nginx
3. Deploy the admin app
4. Configure SSL with Let's Encrypt

**Status**: Pending admin dashboard creation

---

## Step 4: Configure CORS

Once both frontends are deployed, update the Raindrop API to allow requests from both domains.

### Add CORS Headers to Backend:

```typescript
// In src/rehearse-api/index.ts, add CORS headers to all responses

async fetch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Or specify: 'https://your-netlify-app.netlify.app, https://your-vultr-domain.com'
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // ... existing code ...

    // Add CORS headers to all responses
    return new Response(responseBody, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    // ... error handling ...
  }
}
```

Then redeploy the backend:
```bash
raindrop build deploy
```

---

## Performance Characteristics

### Latency:
- **Netlify (Main App)**: ~50ms globally (CDN edge caching)
- **Raindrop API**: <100ms globally (Cloudflare Workers edge compute)
- **Vultr (Admin)**: ~20-100ms (depends on instance location)

### Scalability:
- **Netlify**: Unlimited (serverless, auto-scales)
- **Raindrop**: Unlimited (Cloudflare Workers, auto-scales)
- **Vultr**: Manual scaling (can upgrade instance or add load balancer)

### Cost Estimates (Monthly):
- **Netlify**: $0-19 (free tier covers most use cases)
- **Raindrop**: Pay-as-you-go (minimal for small-medium traffic)
- **Vultr**: $5-50 (depends on instance size)

---

## Security Checklist

- [ ] Enable HTTPS on all domains
- [ ] Configure proper CORS headers
- [ ] Implement authentication (WorkOS integration recommended)
- [ ] Set up rate limiting on API
- [ ] Enable Cloudflare DDoS protection
- [ ] Configure Content Security Policy headers
- [ ] Implement API key rotation
- [ ] Set up monitoring and alerts

---

## Monitoring & Debugging

### Backend API (Raindrop):
```bash
# View logs
raindrop logs tail

# Check status
raindrop build status

# View all routes
raindrop build find --moduleType service
```

### Frontend (Netlify):
- View deploy logs in Netlify dashboard
- Enable analytics in site settings
- Monitor Core Web Vitals

### Database:
- Use admin dashboard for monitoring
- Set up automated backups
- Monitor query performance

---

## Next Steps

1. **Deploy frontend to Netlify** (instructions above)
2. **Test the deployed app** with the live API
3. **Build admin dashboard** (let me know when ready)
4. **Deploy admin to Vultr**
5. **Configure CORS** with both frontend domains
6. **Add authentication** (recommended: WorkOS)
7. **Set up custom domains**
8. **Configure monitoring and alerts**

---

## Troubleshooting

### Common Issues:

**1. CORS Errors:**
- Make sure CORS headers are configured in the backend
- Check that the frontend is making requests to the correct API URL

**2. Build Failures:**
- Verify Node.js version (18+)
- Clear caches: `pnpm clean && pnpm install`
- Check for TypeScript errors: `pnpm type-check`

**3. API Connection Issues:**
- Verify API is running: `curl https://rehearse-api.01k8kpv1gr6b34n7ftxj2whn2x.lmapp.run/health`
- Check network inspector for request details

---

## Support

For issues or questions:
- Raindrop docs: https://docs.liquidmetal.ai
- Netlify docs: https://docs.netlify.com
- Vultr docs: https://www.vultr.com/docs/
