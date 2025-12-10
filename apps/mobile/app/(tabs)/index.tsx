import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOrganizationContext } from '@/lib/deep-linking';
import { getOrganizationById, Organization } from '@/lib/api';
import { StatusBar } from 'expo-status-bar';

export default function HomeScreen() {
  const [orgContext, setOrgContext] = useState<{ orgId?: string; orgSlug?: string } | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);

  useEffect(() => {
    // Load organization context from storage (set by deep link)
    console.log('🏠 HomeScreen: Loading organization context...');
    getOrganizationContext()
      .then((context) => {
        console.log('🏠 HomeScreen: Organization context loaded:', context);
        setOrgContext(context);
        setLoadingContext(false);
        
        // Log API base URL for debugging
        // @ts-ignore - env variables
        const apiBaseUrl = process.env.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://21508d1a3c38.ngrok-free.app';
        console.log('🌐 HomeScreen: API Base URL:', apiBaseUrl);
      })
      .catch((error) => {
        console.error('🏠 HomeScreen: Error loading organization context:', error);
        setLoadingContext(false);
      });
  }, []);

  // Fetch organization details if we have orgId
  const { data: organization, isLoading, error } = useQuery<Organization>({
    queryKey: ['organization', orgContext?.orgId],
    queryFn: () => {
      console.log('🏠 HomeScreen: Fetching organization:', orgContext!.orgId);
      return getOrganizationById(orgContext!.orgId!);
    },
    enabled: !!orgContext?.orgId,
    retry: 1,
  });

  const handleConfigureApp = () => {
    // Get organization ID from context or use default
    const orgId = orgContext?.orgId || '8f79bdba-7095-4a47-90c7-a2e839cc413b'; // Default to Wellness for now
    const orgSlug = orgContext?.orgSlug || 'wellness';
    const deepLink = `bookingapp://org?orgId=${orgId}&orgSlug=${orgSlug}`;
    
    // Use the same API base URL as the API calls (from environment or default to ngrok)
    // @ts-ignore - env variables
    const apiBaseUrl = process.env.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://21508d1a3c38.ngrok-free.app';
    const installPageUrl = `${apiBaseUrl}/org/${orgId}/app?orgId=${orgId}`;
    
    console.log('🔧 handleConfigureApp:', { orgId, orgSlug, installPageUrl, deepLink });
    
    Alert.alert(
      'Configure App',
      `To configure the app with your organization:\n\n1. Open the install page and click "Open App & Configure"\n2. Or scan the QR code from the install page\n3. Or use the deep link directly`,
      [
        { 
          text: 'Open Install Page', 
          onPress: () => {
            console.log('Opening install page:', installPageUrl);
            Linking.openURL(installPageUrl).catch(err => {
              console.error('Failed to open install page:', err);
              Alert.alert('Error', 'Failed to open install page. Please check your internet connection.');
            });
          } 
        },
        { 
          text: 'Use Deep Link', 
          onPress: () => {
            console.log('Opening deep link:', deepLink);
            Linking.openURL(deepLink).catch(err => {
              console.error('Failed to open deep link:', err);
              Alert.alert('Error', 'Failed to open deep link.');
            });
          } 
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  if (loadingContext) {
    return (
      <View style={styles.container}>
        <StatusBar style="auto" />
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.content}>
        {isLoading ? (
          <>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading organization...</Text>
          </>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Failed to load organization</Text>
            {orgContext?.orgId && (
              <Text style={styles.errorSubtext}>Organization ID: {orgContext.orgId}</Text>
            )}
            <TouchableOpacity style={styles.button} onPress={handleConfigureApp}>
              <Text style={styles.buttonText}>Configure App</Text>
            </TouchableOpacity>
          </View>
        ) : organization ? (
          <>
            <Text style={styles.welcomeText}>Welcome to</Text>
            <Text style={styles.orgName}>{organization.name}</Text>
            {organization.description && (
              <Text style={styles.orgDescription}>{organization.description}</Text>
            )}
          </>
        ) : orgContext?.orgSlug ? (
          <>
            <Text style={styles.welcomeText}>Welcome to</Text>
            <Text style={styles.orgName}>{orgContext.orgSlug}</Text>
            <Text style={styles.orgDescription}>Organization context loaded</Text>
          </>
        ) : (
          <>
            <Text style={styles.icon}>📱</Text>
            <Text style={styles.welcomeText}>Welcome to Booking for All</Text>
            <Text style={styles.orgDescription}>
              No organization configured yet.{'\n\n'}
              To get started, tap the button below to configure the app with your organization.
            </Text>
            <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleConfigureApp}>
              <Text style={styles.buttonText}>🔗 Configure App</Text>
            </TouchableOpacity>
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionText}>
                <Text style={styles.instructionTitle}>How to configure:{'\n\n'}</Text>
                1. Tap "Configure App" above{'\n'}
                2. Choose "Open Install Page"{'\n'}
                3. Click "Open App & Configure" on the page{'\n'}
                4. Or scan the QR code from the install page
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  icon: {
    fontSize: 64,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  orgName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 10,
    textAlign: 'center',
  },
  orgDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#999',
  },
  instructionsContainer: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 12,
    marginVertical: 20,
    width: '100%',
    maxWidth: 350,
  },
  instructionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    textAlign: 'left',
  },
  instructionTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#667eea',
  },
  button: {
    backgroundColor: '#667eea',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 20,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#667eea',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginTop: 30,
    marginBottom: 20,
    minWidth: 250,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#e74c3c',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
  },
});

