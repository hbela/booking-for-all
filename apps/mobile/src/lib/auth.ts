import { authClient } from '@booking-for-all/auth';
import * as SecureStore from 'expo-secure-store';

// Configure Better Auth for mobile
// The auth package should handle mobile-specific storage via SecureStore

export { authClient };

export async function getAuthToken(): Promise<string | null> {
  try {
    const session = await authClient.getSession();
    return session.data?.session?.token || null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    const session = await authClient.getSession();
    return !!session.data?.session;
  } catch (error) {
    return false;
  }
}

