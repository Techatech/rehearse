# WorkOS Admin Organization Setup Guide

This guide covers setting up WorkOS authentication for the Rehearse Admin Dashboard with separate admin access.

## Overview

The admin dashboard uses the same WorkOS setup as the main application but with a distinct authentication flow:
- Uses `state: 'admin'` parameter to differentiate admin logins
- Requires manual user setup (no auto-creation of admin accounts)
- Future: Will implement role-based access control (RBAC)

## Current Implementation

### Authentication Flow

1. **Admin Login** (`/admin/auth/login`):
   - Generates WorkOS auth URL with `state: 'admin'`
   - Redirects to WorkOS AuthKit

2. **OAuth Callback** (`/admin/auth/callback`):
   - Verifies `state === 'admin'`
   - Checks if user exists in database
   - **Does not auto-create users** (security measure)
   - Creates session and redirects to admin dashboard

3. **Session Verification** (`/admin/auth/me`):
   - Verifies session using Bearer token
   - Returns user information
   - TODO: Add role check when roles table is implemented

## Setup Instructions

### 1. Configure WorkOS Application

Your existing WorkOS application already works for admin authentication. No additional WorkOS configuration is needed since we're using the same OAuth app with a different redirect URI.

#### Verify Redirect URIs

In your WorkOS dashboard, ensure these redirect URIs are configured:

**Development:**
- `http://localhost:5173/auth/callback` (frontend)
- `http://localhost:5174/auth/callback` (admin)

**Production:**
- `https://capable-fairy-fa3b2a.netlify.app/auth/callback` (frontend)
- `https://rehearse.admin.glamagenie.com/auth/callback` (admin)

### 2. Create Admin Users

Since admin accounts are not auto-created, you need to manually add admin users to your database.

#### Option A: Use Existing User Account

If you already have a user account from the main app:

1. Log in to the main Rehearse app once to create your user record
2. Your account will now work for admin access
3. TODO: When roles are implemented, mark your user as admin

#### Option B: Manually Create Admin User

Connect to your database and run:

```sql
-- First, get your WorkOS user ID by attempting to login to the main app
-- Then insert directly into the database

INSERT INTO users (
  workos_id,
  email,
  name,
  subscription_tier,
  subscription_status,
  created_at
) VALUES (
  'user_YOUR_WORKOS_ID',  -- Replace with your WorkOS user ID
  'admin@yourdomain.com',
  'Admin User',
  'enterprise',
  'active',
  CURRENT_TIMESTAMP
);
```

### 3. Test Admin Authentication

1. Navigate to your admin dashboard:
   - Dev: http://localhost:5174
   - Prod: https://rehearse.admin.glamagenie.com

2. Click "Sign in with WorkOS"

3. Authenticate with your WorkOS account

4. You should be redirected to the admin dashboard

### 4. Environment Variables

Ensure these environment variables are set in your backend:

```bash
# Required for all authentication
WORKOS_API_KEY=your_api_key
WORKOS_CLIENT_ID=your_client_id
WORKOS_REDIRECT_URI=your_frontend_callback_url

# Admin-specific (optional, falls back to WORKOS_REDIRECT_URI if not set)
ADMIN_WORKOS_REDIRECT_URI=https://rehearse.admin.glamagenie.com/auth/callback
ADMIN_FRONTEND_URL=https://rehearse.admin.glamagenie.com
```

Set these using Raindrop CLI:

```bash
# For production deployment
raindrop build env set ADMIN_WORKOS_REDIRECT_URI "https://rehearse.admin.glamagenie.com/auth/callback"
raindrop build env set ADMIN_FRONTEND_URL "https://rehearse.admin.glamagenie.com"
```

## Future: Role-Based Access Control (RBAC)

### Planned Implementation

When implementing proper RBAC, follow these steps:

#### 1. Create Roles Table

```sql
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions TEXT, -- JSON array of permissions
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO roles (name, description, permissions) VALUES
('admin', 'Full system access', '["*"]'),
('support', 'View users and analytics', '["users:read", "analytics:read"]'),
('content_manager', 'Manage personas and content', '["personas:*", "scenarios:*"]');
```

#### 2. Create User Roles Table

```sql
CREATE TABLE IF NOT EXISTS user_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (assigned_by) REFERENCES users(id)
);
```

#### 3. Update Admin Authentication

Modify `/src/rehearse-api/index.ts`:

```typescript
private async handleAdminAuthCallback(request: Request, url: URL): Promise<Response> {
  // ... existing code ...

  // Check if user has admin role
  const hasAdminRole = await this.executeSql(
    `SELECT 1 FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = ${dbUser[0].id} AND r.name IN ('admin', 'support', 'content_manager')
     LIMIT 1`
  );

  if (hasAdminRole.length === 0) {
    const frontendUrl = `${this.env.ADMIN_FRONTEND_URL}/auth/callback?error=${encodeURIComponent('Access denied. Admin role required.')}`;
    return Response.redirect(frontendUrl, 302);
  }

  // ... continue with session creation ...
}
```

#### 4. Implement Permission Checks

Create a middleware for permission checking:

```typescript
private async checkPermission(userId: number, permission: string): Promise<boolean> {
  const result = await this.executeSql(
    `SELECT r.permissions FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = ${userId}`
  );

  if (result.length === 0) return false;

  const permissions = JSON.parse(result[0].permissions);
  return permissions.includes('*') || permissions.includes(permission);
}
```

#### 5. Protect Admin Endpoints

```typescript
// Example for user management endpoint
private async handleAdminGetUsers(url: URL, userId: number): Promise<Response> {
  if (!await this.checkPermission(userId, 'users:read')) {
    return new Response(JSON.stringify({ error: 'Permission denied' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }) as Response;
  }

  // ... existing implementation ...
}
```

## Security Best Practices

### Current Security Measures

1. **No Auto-Creation**: Admin accounts must be manually created
2. **State Verification**: Ensures OAuth callback is for admin login
3. **Session Verification**: Each request validates the session token
4. **HTTPS Only**: Admin dashboard should only be served over HTTPS
5. **Separate Storage**: Admin sessions use separate localStorage keys

### Recommended Additional Security

1. **IP Whitelisting**: Restrict admin access to specific IP addresses
2. **2FA**: Enable two-factor authentication for admin accounts
3. **Audit Logging**: Log all admin actions for compliance
4. **Session Timeout**: Implement shorter session timeouts for admins
5. **Rate Limiting**: Limit login attempts and API requests

### Environment-Specific Configuration

#### Development
```bash
# Allow localhost
ADMIN_WORKOS_REDIRECT_URI=http://localhost:5174/auth/callback
ADMIN_FRONTEND_URL=http://localhost:5174
```

#### Production
```bash
# Use HTTPS and proper domain
ADMIN_WORKOS_REDIRECT_URI=https://rehearse.admin.glamagenie.com/auth/callback
ADMIN_FRONTEND_URL=https://rehearse.admin.glamagenie.com
```

## Troubleshooting

### "Admin account not found" Error

**Cause**: User account doesn't exist in database

**Solution**:
1. First sign up through the main app (https://capable-fairy-fa3b2a.netlify.app)
2. Then try accessing admin dashboard
3. Or manually create the user as shown in "Create Admin Users" section

### "Invalid authentication state" Error

**Cause**: OAuth callback doesn't have `state=admin` parameter

**Solution**: Ensure you're accessing the admin login page, not the regular login

### Authentication Loop

**Cause**: Session verification failing

**Solution**:
1. Clear browser localStorage
2. Clear cookies
3. Try logging in again
4. Check backend logs for session verification errors

### Can't Access After Deployment

**Checklist**:
1. ✓ DNS A record pointing to Vultr VPS IP
2. ✓ SSL certificate installed and valid
3. ✓ Nginx proxy configured correctly
4. ✓ Backend env vars updated with production URLs
5. ✓ WorkOS redirect URI includes production URL
6. ✓ Admin user exists in database

## Monitoring Admin Access

Track admin logins and actions:

```sql
-- View recent admin logins
SELECT u.email, u.name, MAX(i.created_at) as last_active
FROM users u
LEFT JOIN interviews i ON u.id = i.user_id
WHERE u.subscription_tier = 'enterprise'
ORDER BY last_active DESC;

-- Add admin audit logging (future)
CREATE TABLE admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Next Steps

1. **Immediate**:
   - Create your admin user account
   - Test authentication flow
   - Verify all admin endpoints work

2. **Short-term**:
   - Implement roles and permissions
   - Add audit logging
   - Set up monitoring alerts

3. **Long-term**:
   - Implement 2FA for admins
   - Add IP whitelisting
   - Build admin user management UI

## Support

For issues with WorkOS setup:
- WorkOS Dashboard: https://dashboard.workos.com/
- WorkOS Documentation: https://workos.com/docs
- Backend logs: Check Cloudflare Workers logs via Raindrop

For admin access issues:
- Check user exists in database
- Verify WorkOS redirect URIs are configured
- Review backend logs for authentication errors
