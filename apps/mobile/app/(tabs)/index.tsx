import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOrganizationContext } from '@/lib/deep-linking';
import { getOrganizationById, Organization } from '@/lib/api';

export default function HomeScreen() {
  const [orgContext, setOrgContext] = useState<{ orgId?: string; orgSlug?: string } | null>(null);

  useEffect(() => {
    // Load organization context from storage (set by deep link)
    getOrganizationContext().then(setOrgContext);
  }, []);

  // Fetch organization details if we have orgId
  const { data: organization, isLoading, error } = useQuery<Organization>({
    queryKey: ['organization', orgContext?.orgId],
    queryFn: () => getOrganizationById(orgContext!.orgId!),
    enabled: !!orgContext?.orgId,
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#667eea" />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Failed to load organization</Text>
            {orgContext?.orgId && (
              <Text style={styles.errorSubtext}>Organization ID: {orgContext.orgId}</Text>
            )}
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
            <Text style={styles.welcomeText}>Welcome</Text>
            <Text style={styles.orgDescription}>
              No organization selected. Scan a QR code or use a deep link to get started.
            </Text>
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
  welcomeText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
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
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  errorContainer: {
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#e74c3c',
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#999',
  },
});

