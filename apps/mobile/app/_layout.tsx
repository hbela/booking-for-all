import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { handleDeepLink } from '@/lib/deep-linking';

const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    // Handle deep links on app launch
    const handleInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await handleDeepLink(initialUrl);
      }
    };

    // Handle deep links while app is running
    const subscription = Linking.addEventListener('url', async (event) => {
      await handleDeepLink(event.url);
    });

    handleInitialURL();

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </QueryClientProvider>
  );
}

