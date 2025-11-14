# Admin Dashboard Deployment - IP-Based (216.155.142.123)

Deploy the admin dashboard to Vultr VPS accessible via IP address `216.155.142.123`.

## Configuration Summary

**URLs:**
- Admin Dashboard: `http://216.155.142.123` (or `https://216.155.142.123` with SSL)
- Backend API: `https://rehearse-api.01k8kpv1gr6b34n7ftxj2whn2x.lmapp.run`
- Frontend: (current configuration maintained)

---

## Part 1: Push Code to GitHub

### Step 1: Create .env.production for Admin

```bash
cd /home/charles/rehearse/admin
```

Create production environment file:

```bash
cat > .env.production << 'EOF'
VITE_API_URL=https://rehearse-api.01k8kpv1gr6b34n7ftxj2whn2x.lmapp.run
VITE_ADMIN_WORKOS_CLIENT_ID=your_workos_client_id_here
VITE_ADMIN_WORKOS_REDIRECT_URI=http://216.155.142.123/auth/callback
EOF
```

### Step 2: Initialize Git and Push to GitHub

```bash
cd /home/charles/rehearse

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Rehearse admin dashboard"

# Add GitHub remote (replace YOUR_USERNAME and YOUR_REPO)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Note:** If repository is private, you'll need a Personal Access Token instead of password.

---

## Part 2: Deploy to VPS (216.155.142.123)

### Step 1: Access Vultr Console

1. Log into Vultr dashboard
2. Click on your VPS instance (IP: 216.155.142.123)
3. Click "View Console" button
4. Log in as root

### Step 2: Install Required Software

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl start docker
systemctl enable docker

# Install Git
apt install -y git

# Install Nginx
apt install -y nginx
```

### Step 3: Clone Repository

```bash
# Navigate to web directory
cd /var/www

# Clone repository (replace with your GitHub URL)
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git rehearse

# Navigate to admin folder
cd rehearse/admin
```

**If private repository:** GitHub will prompt for username and Personal Access Token.

### Step 4: Build Docker Image

**IMPORTANT:** The Docker build must be run from the repository root (not from the admin directory) because the admin app depends on the shared directory.

```bash
# Navigate to repository root
cd /var/www/rehearse

# Build Docker image from root (using -f flag to specify Dockerfile location)
docker build -f admin/Dockerfile -t rehearse-admin .

# Verify image was created
docker images | grep rehearse-admin
```

### Step 5: Run Docker Container

```bash
# Run container on port 8080
docker run -d \
  --name rehearse-admin \
  --restart unless-stopped \
  -p 8080:80 \
  rehearse-admin

# Verify container is running
docker ps | grep rehearse-admin
```

### Step 6: Configure Nginx Reverse Proxy

```bash
# Create Nginx configuration
cat > /etc/nginx/sites-available/admin << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

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

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Remove default Nginx config
rm -f /etc/nginx/sites-enabled/default

# Enable admin site
ln -s /etc/nginx/sites-available/admin /etc/nginx/sites-enabled/

# Test Nginx configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

### Step 7: Configure Firewall

```bash
# Allow HTTP and HTTPS traffic
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp

# Enable firewall (if not already enabled)
ufw --force enable

# Check status
ufw status
```

### Step 8: Verify Deployment

Open browser and visit: `http://216.155.142.123`

You should see the admin login page.

---

## Part 3: Update Backend CORS Settings

The Raindrop backend needs to allow requests from your VPS IP.

### Update Backend API CORS

```bash
cd /home/charles/rehearse
```

Check current CORS settings in `/src/rehearse-api/index.ts` and ensure it includes:

```typescript
private addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', 'http://216.155.142.123');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Allow-Credentials', 'true');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
```

**Note:** We'll update this in the next step to allow the IP address.

---

## Part 4: Update WorkOS Configuration

### WorkOS Admin Redirect URI

1. Go to WorkOS Dashboard: https://dashboard.workos.com
2. Navigate to your application
3. Go to "Redirects" section
4. Add new redirect URI: `http://216.155.142.123/auth/callback`
5. Save changes

### Set Backend Environment Variables

```bash
cd /home/charles/rehearse

# Set environment variables for Raindrop
export ADMIN_WORKOS_REDIRECT_URI=http://216.155.142.123/auth/callback
export ADMIN_FRONTEND_URL=http://216.155.142.123

# Deploy updated backend
raindrop build deploy
```

---

## Part 5: Optional - SSL Certificate (HTTPS)

If you want HTTPS, you need a domain name (Let's Encrypt doesn't issue certificates for IP addresses).

**Option 1: Use a free subdomain service**
- noip.com
- duckdns.org
- freedns.afraid.org

**Option 2: Use your own domain**
- Point subdomain to 216.155.142.123
- Then use Let's Encrypt

**For now, HTTP is sufficient for internal admin use.**

---

## Part 6: Future Updates

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

### On VPS (via Vultr Console)

```bash
# Navigate to repo
cd /var/www/rehearse

# Pull latest changes
git pull origin main

# Rebuild and restart (must build from root directory)
docker build -f admin/Dockerfile -t rehearse-admin .
docker stop rehearse-admin
docker rm rehearse-admin
docker run -d \
  --name rehearse-admin \
  --restart unless-stopped \
  -p 8080:80 \
  rehearse-admin
```

### Automated Update Script

The repository includes a deployment script at `/var/www/rehearse/deploy-admin.sh`. If it doesn't exist, create it:

```bash
cat > /var/www/rehearse/deploy-admin.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Deploying Rehearse Admin Dashboard..."

# Ensure we're in the repository root
cd /var/www/rehearse

# Pull latest changes
git pull origin main

# Build Docker image from repository root
echo "📦 Building Docker image..."
docker build -f admin/Dockerfile -t rehearse-admin .

# Stop and remove existing container
echo "🛑 Stopping existing container..."
docker stop rehearse-admin 2>/dev/null || true
docker rm rehearse-admin 2>/dev/null || true

# Run new container
echo "▶️  Starting new container..."
docker run -d \
  --name rehearse-admin \
  --restart unless-stopped \
  -p 8080:80 \
  rehearse-admin

echo "✅ Deployment complete!"
echo "🌐 Admin dashboard: http://216.155.142.123"
echo ""
echo "📊 Container status:"
docker ps | grep rehearse-admin
EOF

chmod +x /var/www/rehearse/deploy-admin.sh
```

**Future deployments:**
```bash
cd /var/www/rehearse
git pull origin main
./deploy-admin.sh
```

---

## Part 7: Troubleshooting

### Docker Build Fails with "shared: not found"

If you see an error like `"/shared": not found` during the Docker build, it means you're trying to build from the wrong directory. The admin app depends on the `shared` directory at the repository root.

**Solution:**
```bash
# Make sure you're in the repository root
cd /var/www/rehearse

# Build from root using -f flag
docker build -f admin/Dockerfile -t rehearse-admin .

# DO NOT run this (will fail):
# cd admin && docker build -t rehearse-admin .
```

### Check Docker Container

```bash
# View logs
docker logs rehearse-admin

# View running containers
docker ps

# Restart container
docker restart rehearse-admin
```

### Check Nginx

```bash
# Test configuration
nginx -t

# View logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# Restart Nginx
systemctl restart nginx
```

### Check Network Connectivity

```bash
# From your local machine, test if port 80 is accessible
curl http://216.155.142.123

# From VPS, check if Docker container is responding
curl http://localhost:8080
```

### If Admin Login Fails

1. Check browser console for CORS errors
2. Verify API URL is correct: `https://rehearse-api.01k8kpv1gr6b34n7ftxj2whn2x.lmapp.run`
3. Verify WorkOS redirect URI: `http://216.155.142.123/auth/callback`
4. Check backend CORS allows `http://216.155.142.123`

---

## Summary

**Configuration:**
- ✅ Admin Dashboard: http://216.155.142.123
- ✅ Backend API: https://rehearse-api.01k8kpv1gr6b34n7ftxj2whn2x.lmapp.run
- ✅ Docker + Nginx setup
- ✅ Auto-restart on server reboot
- ✅ GitHub-based deployment workflow

**Access:**
- Open browser: http://216.155.142.123
- Click "Sign in with WorkOS"
- Authenticate with admin account
- Access admin dashboard

**Cost:**
- VPS: $6-12/month
- Everything else: FREE
