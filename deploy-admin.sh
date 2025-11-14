#!/bin/bash
set -e

echo "🚀 Deploying Rehearse Admin Dashboard..."

# Ensure we're in the repository root
cd "$(dirname "$0")"

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
