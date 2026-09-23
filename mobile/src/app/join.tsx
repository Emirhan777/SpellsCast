import { Redirect, useLocalSearchParams } from 'expo-router';
export default function JoinLink() {
  const { room } = useLocalSearchParams<{ room?: string }>();
  return <Redirect href={{ pathname: '/', params: { room: typeof room === 'string' ? room : 'invalid' } }} />;
}
