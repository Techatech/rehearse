# Multi-stage build for production
# NOTE: This Dockerfile must be built from the repository root, not from the admin directory
# Build command: docker build -f admin/Dockerfile -t rehearse-admin .

# Stage 1: Build the React application
FROM node:20-alpine AS builder

WORKDIR /app

# Install axios at root level for shared code
RUN npm init -y && npm install axios@^1.13.2

# Copy shared directory
COPY shared ./shared

# Copy admin package files
COPY admin/package*.json ./admin/

# Install admin dependencies
WORKDIR /app/admin
RUN npm ci --production=false

# Copy admin source code
COPY admin ./

# Build the application
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy custom nginx config
COPY admin/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder /app/admin/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
