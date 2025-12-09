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
          await handleDeepLink(initialUrl);
        }
      } catch (error) {
        console.error('❌ RootLayout: Error handling initial URL:', error);
      }
    };

    // Handle deep links while app is running
    const subscription = Linking.addEventListener('url', async (event) => {
      try {
        console.log('🔗 RootLayout: Deep link received:', event.url);
        await handleDeepLink(event.url);
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

