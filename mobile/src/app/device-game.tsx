import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import DeviceGame from '../DeviceGame';

export default function DeviceGameScreen() {
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);
  return <DeviceGame foreground={foreground} onBack={() => router.back()} />;
}
