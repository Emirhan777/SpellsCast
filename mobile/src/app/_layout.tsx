import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
export default function Layout() {
  return <SafeAreaProvider><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0811' } }}>
    <Stack.Screen name="index" options={{ orientation: 'portrait' }} />
    <Stack.Screen name="device-game" options={{ orientation: 'landscape_right', gestureEnabled: false }} />
  </Stack></SafeAreaProvider>;
}
