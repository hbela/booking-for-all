import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { handleDeepLink } from '@/lib/deep-linking';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  useEffect(() => {
    console.log('🚀 RootLayout: Initializing...');
    
    // Handle deep links on app launch
    const handleInitialURL = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        console.log('🔗 RootLayout: Initial URL:', initialUrl);
        if (initialUrl) {
          // Check if this is an install page URL that we should handle
          const isInstallPageUrl = initialUrl.includes('/org/') && initialUrl.includes('/app');
          if (isInstallPageUrl) {
            console.log('📱 RootLayout: Detected install page URL, handling as deep link');
          }
          const context = await handleDeepLink(initialUrl);
          if (context) {
            console.log('✅ RootLayout: Successfully processed deep link, orgId:', context.orgId);
          } else {
            console.log('⚠️ RootLayout: Deep link processed but no context returned');
          }
        } else {
          console.log('ℹ️ RootLayout: No initial URL found');
        }
      } catch (error) {
        console.error('❌ RootLayout: Error handling initial URL:', error);
      }
    };

    // Handle deep links while app is running
    const subscription = Linking.addEventListener('url', async (event) => {
      try {
        console.log('🔗 RootLayout: Deep link received while running:', event.url);
        const isInstallPageUrl = event.url.includes('/org/') && event.url.includes('/app');
        if (isInstallPageUrl) {
          console.log('📱 RootLayout: Detected install page URL, handling as deep link');
        }
        const context = await handleDeepLink(event.url);
        if (context) {
          console.log('✅ RootLayout: Successfully processed deep link, orgId:', context.orgId);
        } else {
          console.log('⚠️ RootLayout: Deep link processed but no context returned');
        }
      } catch (error) {
        console.error('❌ RootLayout: Error handling deep link:', error);
      }
    });

    handleInitialURL();

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

