# Rehearse Deployment URLs and Configuration

Quick reference for all deployment URLs and configurations.

## URLs

### Development (Local)
- **Frontend**: http://localhost:5173
- **Admin Dashboard**: http://localhost:5174
- **Backend API**: http://localhost:8787

### Production
- **Frontend**: https://capable-fairy-fa3b2a.netlify.app
- **Admin Dashboard**: http://216.155.142.123
- **Backend API**: https://rehearse-api.01k8kpv1gr6b34n7ftxj2whn2x.lmapp.run

## Infrastructure

### Frontend (Netlify)
- **Platform**: Netlify
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`
- **Auto Deploy**: Connected to GitHub

### Backend (Cloudflare Workers)
- **Platform**: Cloudflare Workers via Raindrop
- **Application Name**: `rehearse`
- **Service Name**: `rehearse-api`
- **Framework**: LiquidMetal.AI Raindrop
- **Database**: SmartSQL (Cloudflare D1)
- **Storage**: SmartBuckets
- **Memory**: SmartMemory

### Admin Dashboard (Vultr VPS)
- **Platform**: Vultr VPS
- **IP Address**: 216.155.142.123
- **Location**: Chicago, USA
- **OS**: Debian 12
- **Container**: Docker + Nginx
- **Port**: 80 (HTTP)
- **Deployment Method**: GitHub → Vultr Console

## Environment Variables

### Backend (Raindrop)
Set via `raindrop build env set` or Cloudflare dashboard:

```bash
CEREBRAS_API_KEY=<your_cerebras_api_key>
ELEVENLABS_API_KEY=<your_elevenlabs_api_key>
WORKOS_API_KEY=<your_workos_api_key>
WORKOS_CLIENT_ID=<your_workos_client_id>
WORKOS_REDIRECT_URI=https://capable-fairy-fa3b2a.netlify.app/auth/callback
STRIPE_SECRET_KEY=<your_stripe_secret_key>
STRIPE_WEBHOOK_SECRET=<your_stripe_webhook_secret>
ADMIN_WORKOS_REDIRECT_URI=http://216.155.142.123/auth/callback
ADMIN_FRONTEND_URL=http://216.155.142.123
```

### Frontend (Netlify)
Set via Netlify dashboard or netlify.toml:

```env
VITE_API_URL=https://rehearse-api.01k8kpv1gr6b34n7ftxj2whn2x.lmapp.run
VITE_WORKOS_CLIENT_ID=<your_workos_client_id>
VITE_WORKOS_REDIRECT_URI=https://capable-fairy-fa3b2a.netlify.app/auth/callback
```

### Admin Dashboard (VPS)
Stored in `/home/charles/rehearse/admin/.env.production`:

```env
VITE_API_URL=https://rehearse-api.01k8kpv1gr6b34n7ftxj2whn2x.lmapp.run
VITE_ADMIN_WORKOS_CLIENT_ID=<your_workos_client_id>
VITE_ADMIN_WORKOS_REDIRECT_URI=http://216.155.142.123/auth/callback
```

## WorkOS Configuration

### Main App (Frontend)
- **Redirect URI**: `https://capable-fairy-fa3b2a.netlify.app/auth/callback`
- **OAuth State**: `user` (or omitted)

### Admin Dashboard
- **Redirect URI**: `http://216.155.142.123/auth/callback`
- **OAuth State**: `admin`
- **Same WorkOS Application**: Yes (differentiates via state parameter)

## Stripe Configuration

### Webhook Endpoints
- **Production Endpoint**: `https://rehearse-api.01k8kpv1gr6b34n7ftxj2whn2x.lmapp.run/webhook/stripe`
- **Events to Listen For**:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

### Price IDs
Configure in Stripe dashboard and update frontend pricing page:
- **Free Trial**: 3 days
- **Monthly Plan**: Create price ID in Stripe
- **Annual Plan**: Create price ID in Stripe

## Deployment Guides

- **Frontend**: [Netlify Deployment](./DEPLOYMENT_GUIDE.md)
- **Backend**: Built-in Raindrop deployment (`raindrop build deploy`)
- **Admin Dashboard**: [IP-Based Deployment](./admin/DEPLOYMENT_IP_BASED.md)
- **WorkOS Setup**: [Admin Authentication Setup](./WORKOS_ADMIN_SETUP.md)

## Quick Deployment Commands

### Backend
```bash
# Deploy backend
raindrop build deploy

# Set environment variable
raindrop build env set VARIABLE_NAME "value"

# View logs
raindrop logs tail
```

### Frontend (Netlify)
```bash
# Build locally
cd frontend
npm run build

# Deploy to production
netlify deploy --prod --dir=dist

# Or push to GitHub for auto-deploy
git push origin main
```

### Admin Dashboard (VPS)
```bash
# On VPS via Vultr console
cd /var/www/rehearse
git pull origin main
cd admin
docker build -t rehearse-admin .
docker stop rehearse-admin && docker rm rehearse-admin
docker run -d --name rehearse-admin --restart unless-stopped -p 8080:80 rehearse-admin

# Or use automated script
/var/www/rehearse/deploy-admin.sh
```

## Monitoring

### Health Checks
- **Backend**: https://rehearse-api.01k8kpv1gr6b34n7ftxj2whn2x.lmapp.run/health
- **Frontend**: https://capable-fairy-fa3b2a.netlify.app (Netlify provides uptime monitoring)
- **Admin**: http://216.155.142.123/health

### Logs
- **Backend**: `raindrop logs tail`
- **Frontend**: Netlify dashboard
- **Admin**: `docker logs rehearse-admin`

## Cost Breakdown

| Service | Cost | Notes |
|---------|------|-------|
| Cloudflare Workers | Free tier / ~$5/mo | 100K requests/day free |
| Cloudflare D1 | Free tier | 5GB storage free |
| Netlify | Free | Static hosting |
| Vultr VPS | $6-12/mo | Admin dashboard |
| WorkOS | Free tier / $125/mo | Up to 1M MAU free tier |
| Stripe | 2.9% + 30¢ | Per transaction |
| Cerebras AI | Pay per token | Usage-based |
| ElevenLabs | $5-$22/mo | Character count based |
| **Total Fixed** | **$11-39/mo** | Plus usage-based costs |

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/rehearse/issues)
- **Documentation**: See `/docs` folder
- **Contributions**: [CONTRIBUTING.md](./.github/CONTRIBUTING.md)
