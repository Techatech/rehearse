#!/bin/bash
set -e

echo "🚀 Deploying Rehearse Admin Dashboard from Docker Hub..."

# Pull the latest image from Docker Hub
echo "📦 Pulling latest image from Docker Hub..."
docker pull chuck24/rehearse-admin:latest

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
  chuck24/rehearse-admin:latest

echo "✅ Deployment complete!"
echo "🌐 Admin dashboard: http://216.155.142.123"
echo ""
echo "📊 Container status:"
docker ps | grep rehearse-admin
