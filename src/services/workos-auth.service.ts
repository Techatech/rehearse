import { WorkOS } from '@workos-inc/node';

export interface AuthenticatedUser {
  workosId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export interface WorkOSConfig {
  apiKey: string;
  clientId: string;
  redirectUri: string;
}

export interface WorkOSAuthService {
  getAuthorizationUrl(state?: string): string;
  authenticateWithCode(code: string): Promise<AuthenticatedUser>;
  verifySession(sessionId: string): Promise<AuthenticatedUser | null>;
  createSession(workosUserId: string): Promise<string>;
  deleteSession(sessionId: string): Promise<void>;
}

export function createWorkOSAuthService(config: WorkOSConfig): WorkOSAuthService {
  const workos = new WorkOS(config.apiKey);

  return {
    /**
     * Generate authorization URL for OAuth flow
     */
    getAuthorizationUrl(state?: string): string {
      const authUrl = workos.userManagement.getAuthorizationUrl({
        provider: 'authkit',
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        state: state,
      });
      return authUrl;
    },

    /**
     * Exchange authorization code for user profile
     */
    async authenticateWithCode(code: string): Promise<AuthenticatedUser> {
      try {
        const { user } = await workos.userManagement.authenticateWithCode({
          clientId: config.clientId,
          code,
        });

        const firstName = user.firstName || '';
        const lastName = user.lastName || '';

        return {
          workosId: user.id,
          email: user.email,
          name: (firstName && lastName)
            ? `${firstName} ${lastName}`
            : (user.email.split('@')[0] || 'User'),
          emailVerified: user.emailVerified,
        };
      } catch (error) {
        throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    /**
     * Verify an active session (simplified - returns user ID for lookup)
     */
    async verifySession(sessionId: string): Promise<AuthenticatedUser | null> {
      // For now, we'll use a simple session verification
      // In production, you might want to use JWT tokens or a session store
      try {
        // This is a placeholder - in production, verify the session token
        // For now, we assume sessionId is the workosUserId
        return null; // Client should handle re-authentication
      } catch (error) {
        console.error('Session verification failed:', error);
        return null;
      }
    },

    /**
     * Create a new session for a user (returns user ID as session)
     */
    async createSession(workosUserId: string): Promise<string> {
      // Return the workos user ID as the session identifier
      // In production, you'd create a proper session token
      return workosUserId;
    },

    /**
     * Delete a session (logout)
     */
    async deleteSession(sessionId: string): Promise<void> {
      // In production, you'd invalidate the session token
      // For now, client-side logout is sufficient
      return;
    },
  };
}
