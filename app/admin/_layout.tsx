import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="users" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="gift-codes" />
    </Stack>
  );
}
