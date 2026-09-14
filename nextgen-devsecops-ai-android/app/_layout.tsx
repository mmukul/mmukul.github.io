import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: '#080B14' },
      headerTintColor: '#FFFFFF',
      contentStyle: { backgroundColor: '#080B14' }
    }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth/login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="course/[id]" options={{ title: 'Course' }} />
      <Stack.Screen name="course/modules" options={{ title: 'Modules' }} />
      <Stack.Screen name="course/lesson" options={{ title: 'Lesson' }} />
      <Stack.Screen name="certificates/index" options={{ title: 'Certificates' }} />
      <Stack.Screen name="certificates/[id]" options={{ title: 'Certificate' }} />
    </Stack>
  );
}
