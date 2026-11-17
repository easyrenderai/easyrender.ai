import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { LibraryProvider } from '@/lib/library-context';
import '@/lib/sentry';
import { useTheme } from '@/lib/theme';

void SplashScreen.preventAutoHideAsync();

function Routes() {
  const { user } = useAuth();
  const t = useTheme();

  // use-effect-audit: ignore hides the native splash screen once the sign-in state is known, an external system
  useEffect(() => {
    if (user !== undefined) void SplashScreen.hideAsync();
  }, [user]);
  if (user === undefined) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.background },
        headerTitleStyle: { color: t.foreground },
        headerTintColor: t.foreground,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.background },
      }}
    >
      <Stack.Protected guard={Boolean(user)}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="render/[id]" options={{ title: '', headerBackTitle: 'Library' }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <LibraryProvider>
          <StatusBar style="auto" />
          <Routes />
        </LibraryProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
