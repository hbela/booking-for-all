import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';

const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    // Handle deep links on app launch
    const handleInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleDeepLink(initialUrl);
      }
    };

    // Handle deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    handleInitialURL();

    return () => {
      subscription.remove();
    };
  }, []);

  const handleDeepLink = (url: string) => {
    // Parse deep link URL
    // Format: bookingapp://org?orgId=xxx&orgSlug=wellness
    // or: https://app.booking-for-all.com/org?orgId=xxx&orgSlug=wellness
    const parsed = Linking.parse(url);
    if (parsed.queryParams?.orgId || parsed.queryParams?.orgSlug) {
      // Store organization context for voice agent
      // This will be handled by the deep-linking utility
      console.log('Deep link received:', parsed.queryParams);
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </QueryClientProvider>
  );
}

