import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { WebView } from 'react-native-webview';
import { DEVICE_GAME_HTML } from './generated/device-game';

const SOURCE = { html: DEVICE_GAME_HTML };
const PAUSE = 'window.deviceGame?.pause(); true;';
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
  useEffect(() => {
    if (!foreground) {
      web.current?.injectJavaScript(PAUSE);
      frame.current?.contentWindow?.postMessage('pause-device-game', '*');
    }
  }, [foreground]);
  const pause = () => {
    web.current?.injectJavaScript(PAUSE);
    frame.current?.contentWindow?.postMessage('pause-device-game', '*');
  };
  return <View style={styles.root}>
    {foreground && <Awake />}
    <View style={styles.toolbar}>
      <Action title="Back" onPress={() => { pause(); onBack(); }} />
      <Text accessibilityRole="header" style={styles.title}>Play on this device</Text>
      <Action title="Mirror screen" onPress={() => { pause(); setMirror(true); }} />
    </View>
    {Platform.OS === 'web' ? <iframe ref={frame} title="SpellsCast game" srcDoc={DEVICE_GAME_HTML} style={{ flex: 1, width: '100%', border: 0 }} /> : failed ? <View style={styles.fallback}>
      <Text style={styles.text}>The game could not load. Try reopening it.</Text>
      <Action title="Reload game" onPress={() => { setFailed(false); setRevision(v => v + 1); }} />
    </View> : <WebView key={revision} ref={web} source={SOURCE} originWhitelist={['*']} style={styles.root}
      javaScriptEnabled scrollEnabled={false} bounces={false} overScrollMode="never"
      allowsInlineMediaPlayback mediaPlaybackRequiresUserAction
      javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url.startsWith('about:blank#')}
      onError={() => setFailed(true)} onContentProcessDidTerminate={() => setFailed(true)} onRenderProcessGone={() => setFailed(true)}
      startInLoadingState renderLoading={() => <ActivityIndicator color="#eed297" style={styles.loading} />}
      onLoadEnd={() => { if (!foreground || mirror) pause(); }} />}
    <Modal visible={mirror} animationType="slide" onRequestClose={() => setMirror(false)}>
      <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.guide}>
        <Text accessibilityRole="header" style={styles.heading}>Mirror your game</Text>
        <Text style={styles.text}>The game and drawing pad stay on your phone. Your TV shows the same screen. The game pauses while you set this up.</Text>
        <Text style={styles.subheading}>AirPlay · iPhone or iPad</Text>
        <Text style={styles.text}>1. Connect your phone and an Apple TV, AirPlay-compatible TV, or AirPlay-enabled Mac to the same Wi-Fi network.</Text>
        <Text style={styles.text}>2. Swipe down from the top-right corner to open Control Center. Tap Screen Mirroring (two overlapping rectangles).</Text>
        <Text style={styles.text}>3. Choose your screen. Enter the AirPlay code if asked.</Text>
        <Text style={styles.text}>4. Return to SpellsCast, close this guide, and tap Resume game. Keep drawing on your phone.</Text>
        <Text style={styles.text}>To stop, open Control Center → Screen Mirroring → Stop Mirroring. iOS starts screen mirroring from Control Center.</Text>
        <Text style={styles.subheading}>Connect with a cable</Text>
        <Text style={styles.text}>Connect a compatible USB-C or Lightning display adapter to your phone, then connect HDMI to the TV and select that HDMI input.</Text>
        {Platform.OS === 'android' && <Text style={styles.text}>On Android, use your phone’s Cast or Smart View screen-sharing control with a compatible display. Availability depends on your phone and TV.</Text>}
        <Text style={styles.text}>The TV mirrors your phone’s portrait layout. Wireless mirroring can add delay; the touch controls continue to run locally on your phone.</Text>
        <Action title="Back to game" onPress={() => setMirror(false)} />
      </ScrollView></SafeAreaView>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0917' }, toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, gap: 4 },
  title: { color: '#eed297', fontWeight: '700', fontSize: 12, flexShrink: 1, textAlign: 'center' },
  button: { minHeight: 44, padding: 10, justifyContent: 'center' }, buttonText: { color: '#eed297', fontWeight: '700', fontSize: 13 },
  guide: { padding: 24, gap: 18 }, heading: { color: '#eed297', fontSize: 28, fontWeight: '800' }, subheading: { color: '#fff', fontSize: 19, fontWeight: '700' },
  text: { color: '#c8bcd6', fontSize: 15, lineHeight: 23 }, fallback: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loading: { position: 'absolute', top: '45%', alignSelf: 'center' },
});
