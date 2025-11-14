# Admin Dashboard Deployment Guide

This guide covers deploying the Rehearse Admin Dashboard to a Vultr VPS.

## Prerequisites

- Vultr account
- Domain name (glamagenie.com) with DNS access
- SSH access to your VPS
- Docker and Docker Compose installed on your VPS

## 1. Vultr VPS Setup

### Create VPS Instance

1. Log in to [Vultr](https://my.vultr.com/)
2. Click "Deploy New Server"
3. Choose:
   - **Server Type**: Cloud Compute
   - **Location**: **Chicago** (recommended for best US-wide coverage and low Cloudflare latency)
     - Alternative: Silicon Valley (West Coast) or New York (East Coast)
   - **Operating System**: **Debian 12 x64** (recommended for best Docker support)
   - **Server Size**: $6/month (1 CPU, 1GB RAM, 25GB SSD) - sufficient for admin dashboard
   - **Additional Features**: Enable IPv6, Auto Backups (optional)
4. Set server hostname: `rehearse-admin`
5. Deploy server

**Why these choices?**
- **Chicago**: Central US location with excellent Cloudflare connectivity (~5-15ms latency)
- **Debian 12**: Best stability, Docker support, and matches this deployment guide

### Initial Server Setup

SSH into your new server:

```bash
ssh root@YOUR_VPS_IP
```

Update system packages:

```bash
apt update && apt upgrade -y
```

Install Docker:

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Start Docker service
systemctl start docker
systemctl enable docker

# Verify installation
docker --version
```

Install Docker Compose:

```bash
# Download Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make it executable
chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

## 2. Domain Configuration

### DNS Setup

Add an A record for your subdomain:

1. Log in to your domain registrar (where glamagenie.com is registered)
2. Navigate to DNS settings
3. Add a new A record:
   - **Host**: `rehearse.admin` (or `rehearse.admin.glamagenie` depending on your registrar)
   - **Type**: A
   - **Value**: YOUR_VPS_IP
   - **TTL**: 300 (or Auto)

Wait for DNS propagation (usually 5-30 minutes). Test with:

```bash
nslookup rehearse.admin.glamagenie.com
```

## 3. SSL Certificate Setup (Let's Encrypt)

Install Certbot:

```bash
apt install certbot python3-certbot-nginx -y
```

Create a temporary nginx config for certificate generation:

```bash
cat > /etc/nginx/sites-available/temp-admin <<EOF
server {
    listen 80;
    server_name rehearse.admin.glamagenie.com;

    location / {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
EOF

ln -s /etc/nginx/sites-available/temp-admin /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

Generate SSL certificate:

```bash
certbot certonly --nginx -d rehearse.admin.glamagenie.com
```

The certificates will be stored at:
- Certificate: `/etc/letsencrypt/live/rehearse.admin.glamagenie.com/fullchain.pem`
- Private Key: `/etc/letsencrypt/live/rehearse.admin.glamagenie.com/privkey.pem`

## 4. Application Deployment

### Clone Repository

```bash
cd /opt
git clone YOUR_REPO_URL rehearse
cd rehearse/admin
```

### Environment Configuration

Create production environment file:

```bash
cat > .env.production <<EOF
VITE_API_URL=https://rehearse-api.01k8kpv1gr6b34n7ftxj2whn2x.lmapp.run
EOF
```

### Build Docker Image

```bash
# Build the image
docker build -t rehearse-admin:latest .

# Verify the build
docker images | grep rehearse-admin
```

### Create Docker Compose Configuration

```bash
cat > docker-compose.yml <<EOF
version: '3.8'

services:
  admin:
    image: rehearse-admin:latest
    container_name: rehearse-admin
    restart: unless-stopped
    ports:
      - "8080:80"
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
EOF
```

### Start the Application

```bash
docker-compose up -d

# Check logs
docker-compose logs -f
```

## 5. Nginx Reverse Proxy

Install Nginx (if not already installed):

```bash
apt install nginx -y
```

Create Nginx configuration:

```bash
cat > /etc/nginx/sites-available/rehearse-admin <<EOF
# HTTP - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name rehearse.admin.glamagenie.com;

    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name rehearse.admin.glamagenie.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/rehearse.admin.glamagenie.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rehearse.admin.glamagenie.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/rehearse-admin-access.log;
    error_log /var/log/nginx/rehearse-admin-error.log;

    # Proxy to Docker container
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:8080/health;
        access_log off;
    }
}
EOF
```

Enable the site:

```bash
# Remove temp config
rm /etc/nginx/sites-enabled/temp-admin

# Enable admin site
ln -s /etc/nginx/sites-available/rehearse-admin /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

## 6. Update Backend Environment Variables

Update your Raindrop backend environment variables:

```bash
# On your local machine where you deploy the backend
raindrop build env set ADMIN_WORKOS_REDIRECT_URI "https://rehearse.admin.glamagenie.com/auth/callback"
raindrop build env set ADMIN_FRONTEND_URL "https://rehearse.admin.glamagenie.com"

# Deploy the backend
raindrop build deploy
```

## 7. Verify Deployment

Test your deployment:

```bash
# Check Docker container
docker ps | grep rehearse-admin

# Check Nginx status
systemctl status nginx

# Test health endpoint
curl http://localhost:8080/health

# Test HTTPS
curl https://rehearse.admin.glamagenie.com/health
```

Visit https://rehearse.admin.glamagenie.com in your browser. You should see the admin login page.

## 8. Monitoring and Maintenance

### Auto-renewal for SSL Certificate

Certbot automatically sets up a cron job for renewal. Test it:

```bash
certbot renew --dry-run
```

### Update Application

To deploy updates:

```bash
cd /opt/rehearse/admin

# Pull latest changes
git pull

# Rebuild image
docker build -t rehearse-admin:latest .

# Restart container
docker-compose down
docker-compose up -d

# Check logs
docker-compose logs -f
```

### View Logs

```bash
# Docker logs
docker-compose logs -f

# Nginx logs
tail -f /var/log/nginx/rehearse-admin-access.log
tail -f /var/log/nginx/rehearse-admin-error.log
```

### Backup

Create a backup script:

```bash
cat > /opt/backup-admin.sh <<EOF
#!/bin/bash
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"
mkdir -p \$BACKUP_DIR

# Backup docker image
docker save rehearse-admin:latest | gzip > \$BACKUP_DIR/rehearse-admin_\$DATE.tar.gz

# Backup config files
tar -czf \$BACKUP_DIR/config_\$DATE.tar.gz /opt/rehearse/admin

# Keep only last 7 backups
cd \$BACKUP_DIR
ls -t | tail -n +8 | xargs rm -f
EOF

chmod +x /opt/backup-admin.sh
```

Add to crontab for daily backups:

```bash
crontab -e

# Add this line for daily backup at 2 AM
0 2 * * * /opt/backup-admin.sh
```

## 9. Security Best Practices

### Firewall Setup

```bash
# Install UFW
apt install ufw -y

# Allow SSH, HTTP, HTTPS
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable
ufw status
```

### Fail2Ban Setup

```bash
# Install Fail2Ban
apt install fail2ban -y

# Start and enable
systemctl start fail2ban
systemctl enable fail2ban
```

### Regular Updates

```bash
# Create update script
cat > /opt/update-system.sh <<EOF
#!/bin/bash
apt update
apt upgrade -y
apt autoremove -y
docker system prune -af --volumes
EOF

chmod +x /opt/update-system.sh

# Add to crontab for weekly updates
crontab -e
# Add: 0 3 * * 0 /opt/update-system.sh
```

## 10. Troubleshooting

### Container won't start

```bash
# Check logs
docker logs rehearse-admin

# Check if port is in use
netstat -tulpn | grep 8080

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### SSL Certificate Issues

```bash
# Check certificate status
certbot certificates

# Renew manually
certbot renew --force-renewal

# Restart Nginx
systemctl restart nginx
```

### DNS Issues

```bash
# Check DNS resolution
nslookup rehearse.admin.glamagenie.com

# Test from different location
dig rehearse.admin.glamagenie.com @8.8.8.8
```

## Support

For issues or questions:
- Check application logs: `docker-compose logs -f`
- Check Nginx logs: `tail -f /var/log/nginx/rehearse-admin-error.log`
- Verify backend API is accessible from the VPS

## Cost Breakdown

- **Vultr VPS**: $6/month (1GB RAM, 1 CPU)
- **Domain**: Already owned (glamagenie.com)
- **SSL Certificate**: Free (Let's Encrypt)

**Total Monthly Cost**: ~$6/month
