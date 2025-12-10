import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ORG_CONTEXT_KEY = '@booking_for_all:org_context';

export interface OrganizationContext {
  orgId?: string;
  orgSlug?: string;
}

export async function handleDeepLink(url: string): Promise<OrganizationContext | null> {
  try {
    console.log('🔗 handleDeepLink: Processing URL:', url);
    
    const parsed = Linking.parse(url);
    const queryParams = parsed.queryParams || {};
    
    // Handle both deep link scheme (bookingapp://) and HTTP/HTTPS URLs
    let orgId: string | undefined = queryParams.orgId as string | undefined;
    let orgSlug: string | undefined = queryParams.orgSlug as string | undefined;
    
    // If URL is HTTP/HTTPS and matches install page pattern, extract orgId from path
    if ((url.startsWith('http://') || url.startsWith('https://')) && !orgId) {
      // Pattern: https://domain/org/:orgId/app?orgId=...
      const orgIdMatch = url.match(/\/org\/([^\/\?]+)/);
      if (orgIdMatch && orgIdMatch[1]) {
        orgId = orgIdMatch[1];
        console.log('🔗 handleDeepLink: Extracted orgId from URL path:', orgId);
      }
    }
    
    const orgContext: OrganizationContext = {
      orgId: orgId,
      orgSlug: orgSlug,
    };

    if (orgContext.orgId || orgContext.orgSlug) {
      // Store organization context
      await AsyncStorage.setItem(ORG_CONTEXT_KEY, JSON.stringify(orgContext));
      console.log('✅ handleDeepLink: Stored organization context:', orgContext);
      return orgContext;
    } else {
      console.log('⚠️ handleDeepLink: No orgId or orgSlug found in URL');
    }
  } catch (error) {
    console.error('❌ handleDeepLink: Error handling deep link:', error);
  }
  
  return null;
}

export async function getOrganizationContext(): Promise<OrganizationContext | null> {
  try {
    const stored = await AsyncStorage.getItem(ORG_CONTEXT_KEY);
    if (stored) {
      return JSON.parse(stored) as OrganizationContext;
    }
  } catch (error) {
    console.error('Error getting organization context:', error);
  }
  
  return null;
}

export async function clearOrganizationContext(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ORG_CONTEXT_KEY);
  } catch (error) {
    console.error('Error clearing organization context:', error);
  }
}

