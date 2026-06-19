import { AlertProvider } from '@/template';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { UserProvider } from '@/contexts/UserContext';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    // Handle cold-start deep links
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Handle warm deep links
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  const handleDeepLink = (url: string) => {
    try {
      const parsed = Linking.parse(url);
      // Referral link: onspaceapp://ref/CODE or https://tikboost.app/ref/CODE
      const path = parsed.path || '';
      if (path.startsWith('ref/') || parsed.queryParams?.ref) {
        const code = (path.replace('ref/', '') || parsed.queryParams?.ref as string || '').toUpperCase().trim();
        if (code) {
          router.push({ pathname: '/auth', params: { ref: code, mode: 'signup' } });
        }
      }
    } catch {
      // ignore malformed deep links
    }
  };

  return null;
}

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <UserProvider>
          <StatusBar style="light" />
          <DeepLinkHandler />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="transactions" options={{ presentation: 'card' }} />
            <Stack.Screen name="orders" options={{ presentation: 'card' }} />
            <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
            <Stack.Screen name="help" options={{ presentation: 'card' }} />
            <Stack.Screen name="buy-stars" options={{ presentation: 'card' }} />
            <Stack.Screen name="verify-email" options={{ presentation: 'card' }} />
            <Stack.Screen name="admin" options={{ presentation: 'card' }} />
            <Stack.Screen name="edit-profile" options={{ presentation: 'card' }} />
            <Stack.Screen name="login-calendar" options={{ presentation: 'card' }} />
            <Stack.Screen name="notification-settings" options={{ presentation: 'card' }} />
            <Stack.Screen name="redeem-gift" options={{ presentation: 'card' }} />
            <Stack.Screen name="rewards" options={{ presentation: 'card' }} />
            <Stack.Screen name="subscription" options={{ presentation: 'card' }} />
          </Stack>
        </UserProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
