# Admin Dashboard Deployment via GitHub (Vultr Console)

This guide shows how to deploy the admin dashboard to Vultr VPS using GitHub as the source, without requiring SSH from your local machine.

## Prerequisites

- ✅ Vultr VPS running (Debian 12, Chicago location)
- ✅ Access to Vultr console (web-based terminal)
- ✅ GitHub repository (public or private)
- ✅ Domain DNS configured (A record pointing to VPS IP)

---

## Part 1: Push Code to GitHub

### Step 1: Initialize Git Repository (if not already done)

```bash
cd /home/charles/rehearse

# Initialize git
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Rehearse admin dashboard with WorkOS auth and Stripe payments"
```

### Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. Create repository name: `rehearse` (or your preferred name)
3. **Do NOT initialize** with README (we already have code)
4. Choose **Private** if you want to keep it private
5. Click "Create repository"

### Step 3: Push to GitHub

```bash
# Add GitHub remote (replace YOUR_USERNAME and YOUR_REPO)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**If repository is private**, you'll need a Personal Access Token:
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope
3. Copy the token
4. When prompted for password during `git push`, paste the token instead

---

## Part 2: Deploy to Vultr VPS via Console

### Step 1: Access Vultr Console

1. Log into Vultr dashboard
2. Click on your VPS instance
3. Click "View Console" button (opens web-based terminal)
4. Log in with root credentials

### Step 2: Install Required Software

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Start Docker
systemctl start docker
systemctl enable docker

# Install Git
apt install -y git

# Install Nginx (reverse proxy)
apt install -y nginx

# Install Certbot (SSL certificates)
apt install -y certbot python3-certbot-nginx
```

### Step 3: Clone Repository from GitHub

```bash
# Navigate to web directory
cd /var/www

# Clone repository (replace with your GitHub URL)
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git rehearse

# Navigate to admin folder
cd rehearse/admin
```

**If private repository:**
```bash
# GitHub will prompt for credentials
# Username: your_github_username
# Password: paste your Personal Access Token (not your actual password)
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git rehearse
```

### Step 4: Configure Environment Variables

Create environment file for production:

```bash
# Still in /var/www/rehearse/admin
nano .env.production
```

Add your production environment variables:
```env
VITE_API_URL=https://api.glamagenie.com
VITE_ADMIN_WORKOS_CLIENT_ID=your_workos_client_id
VITE_ADMIN_WORKOS_REDIRECT_URI=https://admin.glamagenie.com/auth/callback
```

Save and exit: `Ctrl+X`, then `Y`, then `Enter`

### Step 5: Build Docker Image

```bash
# Build Docker image
docker build -t rehearse-admin .

# Verify image was created
docker images
```

### Step 6: Run Docker Container

```bash
# Run container on port 8080
docker run -d \
  --name rehearse-admin \
  --restart unless-stopped \
  -p 8080:80 \
  rehearse-admin

# Verify container is running
docker ps
```

### Step 7: Configure Nginx Reverse Proxy

```bash
# Create Nginx configuration
nano /etc/nginx/sites-available/admin.glamagenie.com
```

Paste this configuration:
```nginx
server {
    listen 80;
    server_name admin.glamagenie.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Save and exit.

```bash
# Enable site
ln -s /etc/nginx/sites-available/admin.glamagenie.com /etc/nginx/sites-enabled/

# Test Nginx configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

### Step 8: Set Up SSL Certificate

```bash
# Obtain SSL certificate from Let's Encrypt
certbot --nginx -d admin.glamagenie.com

# Follow prompts:
# - Enter email address
# - Agree to Terms of Service
# - Choose to redirect HTTP to HTTPS (recommended)
```

Certbot will automatically:
- Obtain SSL certificate
- Update Nginx configuration
- Set up auto-renewal

### Step 9: Verify Deployment

Visit `https://admin.glamagenie.com` in your browser. You should see the admin login page.

---

## Part 3: Update Backend Environment Variables

Your Raindrop backend needs to know about the admin frontend URL.

### Update raindrop.manifest

```bash
cd /var/www/rehearse

# Edit manifest
nano raindrop.manifest
```

Update these values:
```
env "ADMIN_WORKOS_REDIRECT_URI" {
  secret = false
}

env "ADMIN_FRONTEND_URL" {
  secret = false
}
```

### Set Environment Variables in Cloudflare Workers

Via Raindrop CLI or Cloudflare dashboard, set:
```
ADMIN_WORKOS_REDIRECT_URI=https://admin.glamagenie.com/auth/callback
ADMIN_FRONTEND_URL=https://admin.glamagenie.com
```

### Redeploy Backend

```bash
cd /var/www/rehearse
raindrop build deploy
```

---

## Part 4: Future Updates (Continuous Deployment)

When you make changes to the admin app:

### On Local Machine

```bash
# Make changes to code
# ...

# Commit and push
git add .
git commit -m "Update admin dashboard"
git push origin main
```

### On Vultr VPS (via Console)

```bash
# Navigate to repo
cd /var/www/rehearse

# Pull latest changes
git pull origin main

# Rebuild Docker image
cd admin
docker build -t rehearse-admin .

# Stop old container
docker stop rehearse-admin
docker rm rehearse-admin

# Start new container
docker run -d \
  --name rehearse-admin \
  --restart unless-stopped \
  -p 8080:80 \
  rehearse-admin

# Verify
docker ps
```

---

## Part 5: Troubleshooting

### Check Docker Container Logs

```bash
docker logs rehearse-admin
```

### Check Nginx Logs

```bash
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### Restart Services

```bash
# Restart Docker container
docker restart rehearse-admin

# Restart Nginx
systemctl restart nginx
```

### DNS Issues

Verify DNS is pointing to your VPS:
```bash
nslookup admin.glamagenie.com
```

Should return your VPS IP address.

### SSL Certificate Renewal

Certbot auto-renews, but you can test:
```bash
certbot renew --dry-run
```

---

## Part 6: Optional - Automated Deployment Script

Create a deployment script for easy updates:

```bash
nano /var/www/rehearse/deploy-admin.sh
```

```bash
#!/bin/bash
set -e

echo "🚀 Deploying Rehearse Admin Dashboard..."

# Pull latest code
cd /var/www/rehearse
git pull origin main

# Rebuild Docker image
cd admin
docker build -t rehearse-admin .

# Stop and remove old container
docker stop rehearse-admin || true
docker rm rehearse-admin || true

# Start new container
docker run -d \
  --name rehearse-admin \
  --restart unless-stopped \
  -p 8080:80 \
  rehearse-admin

echo "✅ Deployment complete!"
echo "🌐 Admin dashboard: https://admin.glamagenie.com"

# Show container status
docker ps | grep rehearse-admin
```

Make executable:
```bash
chmod +x /var/www/rehearse/deploy-admin.sh
```

**Future deployments:**
```bash
# Just run the script
/var/www/rehearse/deploy-admin.sh
```

---

## Summary

**Deployment Flow:**
1. ✅ Local: Make changes → Commit → Push to GitHub
2. ✅ VPS: Pull from GitHub → Build Docker → Run container
3. ✅ Nginx: Reverse proxy with SSL

**No SSH Required:**
- Use Vultr web console for all VPS commands
- Clean, secure deployment workflow
- Industry-standard CI/CD approach

**Cost:**
- VPS: $6-12/month
- SSL: Free (Let's Encrypt)
- GitHub: Free (public repo) or $4/month (private)

**URLs:**
- Admin: https://admin.glamagenie.com
- Frontend: https://glamagenie.com
- API: https://api.glamagenie.com
