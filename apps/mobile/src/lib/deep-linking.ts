import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ORG_CONTEXT_KEY = '@booking_for_all:org_context';

export interface OrganizationContext {
  orgId?: string;
  orgSlug?: string;
}

export async function handleDeepLink(url: string): Promise<OrganizationContext | null> {
  try {
    const parsed = Linking.parse(url);
    const queryParams = parsed.queryParams || {};
    
    const orgContext: OrganizationContext = {
      orgId: queryParams.orgId as string | undefined,
      orgSlug: queryParams.orgSlug as string | undefined,
    };

    if (orgContext.orgId || orgContext.orgSlug) {
      // Store organization context
      await AsyncStorage.setItem(ORG_CONTEXT_KEY, JSON.stringify(orgContext));
      return orgContext;
    }
  } catch (error) {
    console.error('Error handling deep link:', error);
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

