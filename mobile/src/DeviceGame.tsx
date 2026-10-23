import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { DEVICE_GAME_HTML } from './generated/device-game';
import { useWand } from './useWand';
import { DEVICE_BESTS_KEY, readDeviceBests, type DeviceBests, type DeviceMode } from './device-controls';
import type { Point } from './protocol';

function Action({ title, onPress }: { title: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.button}><Text style={styles.buttonText}>{title}</Text></Pressable>;
}
function Awake() { useKeepAwake(undefined, { suppressDeactivateWarnings: true }); return null; }

export default function DeviceGame({ foreground, onBack }: { foreground: boolean; onBack: () => void }) {
  const web = useRef<WebView>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [mirror, setMirror] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [mode, setMode] = useState<DeviceMode>('tilt');
  const [initialBests, setInitialBests] = useState<DeviceBests | null>(null);
  const [storageFailed, setStorageFailed] = useState(false);
  const bests = useRef<DeviceBests>({ tilt: 0, finger: 0 });
  const saving = useRef(Promise.resolve());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    void AsyncStorage.getItem(DEVICE_BESTS_KEY).then(value => {
      if (!alive.current) return;
      bests.current = readDeviceBests(value ? JSON.parse(value) : {});
      setInitialBests(bests.current);
    }).catch(() => { if (alive.current) { setInitialBests({ tilt: 0, finger: 0 }); setStorageFailed(true); } });
    return () => { alive.current = false; };
  }, []);
  const source = useMemo(() => initialBests ? { html: DEVICE_GAME_HTML.replace('<script>', `<script>window.__deviceBests=${JSON.stringify(initialBests)};`) } : null, [initialBests]);
  const send = useCallback((method: string, ...args: unknown[]) => {
    web.current?.injectJavaScript(`window.deviceGame?.${method}(...${JSON.stringify(args)}); true;`);
    frame.current?.contentWindow?.postMessage({ deviceGameCommand: method, args }, '*');
  }, []);
  const onPoint = useCallback((point: Point) => send('move', point), [send]);
  const unavailable = useCallback(() => send('motionUnavailable'), [send]);
  const { enable, center } = useWand(foreground && !mirror && mode === 'tilt' && !failed, onPoint, unavailable, true);
  const handle = useCallback((data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const msg = data as Record<string, unknown>;
    if (msg.type === 'back') onBack();
    if (msg.type === 'mirror') { send('pause'); setMirror(true); }
    if (msg.type === 'center') center();
    if (msg.type === 'mode' && (msg.mode === 'tilt' || msg.mode === 'finger')) { setMode(msg.mode); center(); }
    if (msg.type === 'motion' && typeof msg.token === 'number') {
      const token = msg.token;
      void enable().then(granted => { if (alive.current) { center(); send('motionReady', granted, token); } });
    }
    if (msg.type === 'best' && (msg.mode === 'tilt' || msg.mode === 'finger') && typeof msg.score === 'number' && Number.isSafeInteger(msg.score) && msg.score >= 0 && msg.score > bests.current[msg.mode]) {
      bests.current = { ...bests.current, [msg.mode]: msg.score };
      const snapshot = JSON.stringify(bests.current);
      saving.current = saving.current.then(() => AsyncStorage.setItem(DEVICE_BESTS_KEY, snapshot)).catch(() => { if (alive.current) setStorageFailed(true); });
    }
  }, [onBack, send, center, enable]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const listener = (event: MessageEvent) => { if (event.source === frame.current?.contentWindow && event.data?.spellscast) handle(event.data); };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [handle]);
  useEffect(() => { if (!foreground) send('pause'); else center(); }, [foreground, send, center]);
  return <View style={styles.root}>
    <StatusBar hidden />
    {foreground && <Awake />}
    {!source ? <ActivityIndicator color="#eed297" style={styles.root} /> : Platform.OS === 'web' ? <iframe ref={frame} title="SpellsCast game" srcDoc={source.html} style={{ flex: 1, width: '100%', border: 0 }} /> : failed ? <View style={styles.fallback}>
      <Text style={styles.text}>The game could not load. Try reopening it.</Text>
      <Action title="Reload game" onPress={() => { setInitialBests({ ...bests.current }); setFailed(false); setRevision(v => v + 1); }} /><Action title="Back" onPress={onBack} />
    </View> : <WebView key={revision} ref={web} source={source} originWhitelist={['*']} style={styles.root}
      javaScriptEnabled scrollEnabled={false} bounces={false} overScrollMode="never"
      automaticallyAdjustContentInsets={false} contentInsetAdjustmentBehavior="never"
      allowsInlineMediaPlayback mediaPlaybackRequiresUserAction
      javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false}
      onMessage={event => { try { handle(JSON.parse(event.nativeEvent.data)); } catch {} }}
      onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url.startsWith('about:blank#')}
      onError={() => setFailed(true)} onContentProcessDidTerminate={() => setFailed(true)} onRenderProcessGone={() => setFailed(true)}
      startInLoadingState renderLoading={() => <ActivityIndicator color="#eed297" style={styles.loading} />}
      onLoadEnd={() => { if (!foreground || mirror) send('pause'); }} />}
    {storageFailed && <Text style={styles.warning}>Best scores may only be saved for this session.</Text>}
    <Modal visible={mirror} animationType="slide" supportedOrientations={['landscape-right']} onRequestClose={() => setMirror(false)}>
      <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.guide}>
        <Text accessibilityRole="header" style={styles.heading}>Mirror your game</Text>
        <Text style={styles.text}>The whole landscape screen is the game. Tilt to cast with the hold button, or choose Finger mode to draw directly on the game. Each mode keeps its own best score.</Text>
        <Text style={styles.subheading}>AirPlay · iPhone or iPad</Text>
        <Text style={styles.text}>1. Connect your phone and an Apple TV, AirPlay-compatible TV, or AirPlay-enabled Mac to the same Wi-Fi network.</Text>
        <Text style={styles.text}>2. Open Control Center from the top-right corner. Tap Screen Mirroring (two overlapping rectangles), then choose your screen. Enter its AirPlay code if asked.</Text>
        <Text style={styles.text}>3. Return to SpellsCast, close this guide, and tap Resume game. In Tilt mode, your current pose becomes the center.</Text>
        <Text style={styles.text}>To stop, open Control Center → Screen Mirroring → Stop Mirroring. iOS starts screen mirroring from Control Center.</Text>
        <Text style={styles.subheading}>Connect with a cable</Text>
        <Text style={styles.text}>Connect a compatible USB-C or Lightning display adapter to your phone, then connect HDMI to the TV and select that HDMI input.</Text>
        {Platform.OS === 'android' && <Text style={styles.text}>Use Cast or Smart View on Android with a compatible display.</Text>}
        <Text style={styles.text}>Wireless mirroring can add display delay. Borders on the TV depend on its aspect ratio and mirroring settings.</Text>
        <Action title="Back to game" onPress={() => setMirror(false)} />
      </ScrollView></SafeAreaView>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0917' },
  button: { minHeight: 44, padding: 10, justifyContent: 'center' }, buttonText: { color: '#eed297', fontWeight: '700', fontSize: 13 },
  guide: { padding: 24, gap: 18 }, heading: { color: '#eed297', fontSize: 28, fontWeight: '800' }, subheading: { color: '#fff', fontSize: 19, fontWeight: '700' },
  text: { color: '#c8bcd6', fontSize: 15, lineHeight: 23 }, fallback: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loading: { position: 'absolute', top: '45%', alignSelf: 'center' }, warning: { position: 'absolute', bottom: 0, alignSelf: 'center', color: '#ffbfbd', fontSize: 10 },
});
