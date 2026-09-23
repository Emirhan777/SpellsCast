import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type GestureResponderEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import { SPELLS, recognize } from '../../game/spells';
import { joinRoom, type Controller } from './controller';
import { GAME_URL, parseRoom, type Hud, type Point } from './protocol';
import { useWand } from './useWand';
import StartGame from './StartGame';

const GOLD = '#eed297', DIM = '#a79eb8';
type Phase = 'home' | 'start' | 'joining' | 'ready' | 'playing' | 'practice';
type Spell = typeof SPELLS[number];
const haptic = () => { void Haptics.selectionAsync().catch(() => {}); };

function Rune({ spell, size = 44 }: { spell: Spell; size?: number }) {
  const points = spell.glyph.map(([x, y]) => `${10 + x * 80},${10 + y * 80}`).join(' ');
  const a = spell.glyph[spell.glyph.length - 2], b = spell.glyph[spell.glyph.length - 1];
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const x = 10 + b[0] * 80, y = 10 + b[1] * 80;
  const arrow = `M${x},${y} L${x - 12 * Math.cos(angle - .45)},${y - 12 * Math.sin(angle - .45)} M${x},${y} L${x - 12 * Math.cos(angle + .45)},${y - 12 * Math.sin(angle + .45)}`;
  return <Svg width={size} height={size} viewBox="0 0 100 100">
    <Polyline points={points} fill="none" stroke={spell.color} strokeWidth="11" opacity={0.14} strokeLinejoin="round" strokeLinecap="round" />
    <Polyline points={points} fill="none" stroke={spell.color} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
    <Path d={arrow} stroke={spell.color} strokeWidth="4" strokeLinecap="round" fill="none" />
  </Svg>;
}
function Wand() {
  return <Svg width={116} height={116} viewBox="0 0 116 116">
    <Circle cx="58" cy="58" r="54" stroke="#68516f" strokeWidth="1" fill="#20182d" />
    <Circle cx="58" cy="58" r="44" stroke="#3a304a" strokeWidth="1" fill="none" />
    <Path d="M34 83 L73 44" stroke={GOLD} strokeWidth="7" strokeLinecap="round" />
    <Path d="M66 51 L75 42" stroke="#fff7dc" strokeWidth="7" strokeLinecap="round" />
    <Path d="M79 20 L82 30 L92 33 L82 36 L79 46 L76 36 L66 33 L76 30 Z" fill={GOLD} />
    <Circle cx="33" cy="36" r="3" fill="#9cdfff" /><Circle cx="87" cy="73" r="2" fill="#ba9bea" />
  </Svg>;
}
function Button({ title, onPress, secondary = false, disabled = false, testID }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; testID?: string }) {
  return <Pressable accessibilityRole="button" testID={testID} onPress={onPress} disabled={disabled}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, (pressed || disabled) && { opacity: .55 }]}>
    <Text style={[styles.buttonText, secondary && { color: '#e9e1f5' }]}>{title}</Text>
  </Pressable>;
}
function Awake() { useKeepAwake(undefined, { suppressDeactivateWarnings: true }); return null; }

export default function SpellsCast() {
  const params = useLocalSearchParams<{ room?: string }>();
  const [phase, setPhase] = useState<Phase>('home');
  const [code, setCode] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [error, setError] = useState('');
  const [scanner, setScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [hud, setHud] = useState<Hud>({});
  const [status, setStatus] = useState('lobby');
  const [mode, setMode] = useState<'tilt' | 'touch'>('touch');
  const [casting, setCasting] = useState(false);
  const [echo, setEcho] = useState('');
  const [trace, setTrace] = useState<number[][]>([]);
  const [practiceSpell, setPracticeSpell] = useState(0);
  const [foreground, setForeground] = useState(true);
  const [motionBusy, setMotionBusy] = useState(false);
  const [motionNote, setMotionNote] = useState('');
  const [padSide, setPadSide] = useState(200);
  const controller = useRef<Controller | null>(null);
  const attempt = useRef<AbortController | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const echoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const castingRef = useRef(false);
  const points = useRef<number[][]>([]);
  const sample = useRef<Point>({ x: .5, y: .5 });
  const padSize = useRef({ width: 1, height: 1 });
  const lastPaint = useRef(0);
  const scanLock = useRef(false);
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  const alive = useRef(true);
  const lastEcho = useRef('');

  const feedback = useCallback((message: string) => {
    if (echoTimer.current) clearTimeout(echoTimer.current);
    setEcho(message);
    echoTimer.current = setTimeout(() => setEcho(''), 2200);
  }, []);
  const release = useCallback((cancel = false) => {
    if (!castingRef.current) return;
    castingRef.current = false; setCasting(false);
    controller.current?.send({ ...sample.current, cast: false });
    if (phaseRef.current === 'practice' && !cancel) {
      const result = recognize(points.current);
      if (result.spell) { feedback(result.spell.name + ' ✓'); haptic(); }
      else feedback('Try again — follow the rune’s arrow.');
    }
  }, [feedback]);
  const disconnect = useCallback(() => {
    release(true);
    attempt.current?.abort(); attempt.current = null;
    controller.current?.destroy(); controller.current = null;
    if (timeout.current) clearTimeout(timeout.current);
  }, [release]);
  const leave = () => { disconnect(); setPhase('home'); setHud({}); setEcho(''); setError(''); setTrace([]); };
  const receivePoint = useCallback((point: Point) => {
    sample.current = point;
    controller.current?.send({ ...point, cast: castingRef.current });
    if (castingRef.current && points.current.length < 2000) {
      points.current.push([point.x, point.y]);
      if (performance.now() - lastPaint.current > 32) {
        lastPaint.current = performance.now(); setTrace([...points.current]);
      }
    }
  }, []);
  const unavailable = useCallback(() => {
    release(true); setMode('touch'); setMotionNote('Motion is unavailable. Draw on the pad to cast.');
  }, [release]);
  const { enable: enableWand, center: centerWand } = useWand(foreground && phase === 'playing' && mode === 'tilt', receivePoint, unavailable);
  const connect = useCallback(async (input: string) => {
    let room: string;
    try { room = parseRoom(input); } catch (e) { setError((e as Error).message); return; }
    disconnect(); setScanner(false); setCode(room); setPhase('joining'); setError(''); setHud({}); setEcho(''); setTrace([]);
    lastEcho.current = '';
    const abort = new AbortController(); attempt.current = abort;
    const current = () => alive.current && attempt.current === abort && !abort.signal.aborted;
    timeout.current = setTimeout(() => {
      if (!current()) return;
      abort.abort(); setPhase('home'); setError('Could not reach the room. Check your connection and try again.');
    }, 15000);
    try {
      const result = await joinRoom(room, {
        onHud(next) {
          if (!current()) return;
          setHud(next);
          const key = `${next.score}:${next.spell}:${next.castOk}`;
          if (next.spell && key !== lastEcho.current) {
            lastEcho.current = key;
            feedback(next.spell + (next.castOk === false ? ' · no target' : (next.combo || 0) > 1 ? ` · ×${next.combo}` : ' ✓'));
            if (next.castOk !== false) haptic();
          }
        },
        onStatus(next) { if (current()) setStatus(next); },
        onClosed(reason) {
          if (!current()) return;
          release(true); controller.current = null; abort.abort();
          setPhase('home'); setError(reason);
        },
      }, abort.signal);
      if (!current()) { result.destroy(); return; }
      if (timeout.current) clearTimeout(timeout.current);
      controller.current = result; setPhase('ready'); haptic();
    } catch (e) {
      if (current()) { setPhase('home'); setError((e as Error).message); abort.abort(); }
    } finally { if (attempt.current === abort && timeout.current) clearTimeout(timeout.current); }
  }, [disconnect, feedback, release]);

  useEffect(() => {
    if (params.room && typeof params.room === 'string') {
      const room = params.room;
      // Let navigation settle; cancel a superseded deep link before joining.
      const timer = setTimeout(() => { void connect(room); router.setParams({ room: undefined }); }, 0);
      return () => clearTimeout(timer);
    }
  }, [params.room, connect]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; disconnect(); if (echoTimer.current) clearTimeout(echoTimer.current); };
  }, [disconnect]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      setForeground(next === 'active');
      if (next !== 'active') release(true);
      if (next === 'background') {
        setScanner(false);
        if (controller.current || phaseRef.current === 'joining') {
          disconnect(); setPhase('home'); setError('You left the game. Tap Connect to rejoin your room.');
        }
      }
      if (next === 'active') centerWand();
    });
    return () => sub.remove();
  }, [disconnect, release, centerWand]);
  useEffect(() => {
    if (phase !== 'playing' || !foreground) return;
    const timer = setInterval(() => controller.current?.send({ ...sample.current, cast: castingRef.current }), 250);
    return () => clearInterval(timer);
  }, [phase, foreground]);

  async function startTilt() {
    setMotionBusy(true);
    const granted = await enableWand();
    if (!alive.current || !controller.current) { setMotionBusy(false); return; }
    setMode(granted ? 'tilt' : 'touch');
    setMotionNote(granted ? '' : 'Motion permission is off. Draw on the pad, or allow motion in Settings.');
    setMotionBusy(false); setPhase('playing'); centerWand();
  }
  async function openScanner() {
    setError('');
    const allowed = permission?.granted || (await requestPermission()).granted;
    if (allowed) { scanLock.current = false; setScanner(true); }
    else setError('Camera access is off. Enter the room code below, or allow the camera in Settings.');
  }
  function scan(data: string) {
    if (scanLock.current) return;
    scanLock.current = true;
    try { const room = parseRoom(data); void connect(room); }
    catch (e) { setScanner(false); setError((e as Error).message); }
  }
  function touchPoint(event: GestureResponderEvent) {
    const { locationX, locationY } = event.nativeEvent;
    receivePoint({ x: Math.min(1, Math.max(0, locationX / padSize.current.width)), y: Math.min(1, Math.max(0, locationY / padSize.current.height)) });
  }
  function begin(event: GestureResponderEvent) {
    if (modeRef.current === 'touch' || phaseRef.current === 'practice') touchPoint(event);
    points.current = [[sample.current.x, sample.current.y]]; setTrace([]);
    castingRef.current = true; setCasting(true); setEcho('');
    controller.current?.send({ ...sample.current, cast: true }); haptic();
  }
  function practice() {
    disconnect(); setPhase('practice'); setMode('touch'); setTrace([]); setEcho(''); setError('');
  }
  const active = phase === 'playing' || phase === 'practice';
  const isPractice = phase === 'practice';
  const lives = hud.lives ?? 3;
  const castTitle = echo || (casting ? 'Weave your spell…' : isPractice ? SPELLS[practiceSpell].name : status === 'over' ? 'Wand down' : 'Ready to cast');

  return <LinearGradient colors={['#21152f', '#0a0811', '#0a0811']} style={styles.root}>
    <StatusBar style="light" />
    {active && foreground && <Awake />}
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {!active ? <ScrollView contentContainerStyle={styles.home} keyboardShouldPersistTaps="handled">
        <View style={styles.wordmark}><Text style={styles.eyebrow}>SPELLSCAST</Text><Text style={styles.small}>YOUR POCKET WAND</Text></View>
        {phase !== 'start' && <View style={styles.hero}><Wand /><Text style={styles.title}>A little motion.{ '\n' }A little magic.</Text>
          <Text style={styles.description}>Your iPhone is the wand.{ '\n' }The big screen is your spellbook come alive.</Text></View>}
        {phase === 'start' && <StartGame foreground={foreground} onConnect={connect} onBack={() => setPhase('home')} onJoin={() => { setShowJoin(true); setPhase('home'); }} />}
        {phase === 'home' && <>
          <Button title="Start a game" testID="start-game-button" onPress={() => { setError(''); setPhase('start'); }} />
          <Text style={styles.instructions}>Send the game to a computer or set it up on your TV.</Text>
          <Button title="Join an existing game" secondary testID="join-game-button" onPress={() => setShowJoin(!showJoin)} />
          {showJoin && <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.cardTitle}>Join an existing game</Text>
          <Button title="Scan the game QR" testID="scan-button" onPress={() => { void openScanner(); }} />
          <Text style={styles.instructions}>Open SpellsCast on a computer or TV, then scan its QR here.</Text>
          <View style={styles.divider}><View style={styles.rule} /><Text style={styles.small}>OR ENTER THE ROOM CODE</Text><View style={styles.rule} /></View>
          <View style={styles.codeRow}><TextInput testID="room-code" accessibilityLabel="Six-digit room code" value={code} onChangeText={setCode}
            placeholder="000000" placeholderTextColor="#665b78" keyboardType="number-pad" maxLength={6} style={styles.codeInput} returnKeyType="go"
            onSubmitEditing={() => { if (/^\d{6}$/.test(code)) void connect(code); }} />
            <View style={{ flex: 1 }}><Button title="Connect" testID="connect-button" disabled={!/^\d{6}$/.test(code)} onPress={() => { void connect(code); }} /></View></View>
          {permission && !permission.granted && !permission.canAskAgain && <Button title="Open camera settings" secondary onPress={() => { void Linking.openSettings(); }} />}
          </View>}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Button title="Practice your spells" secondary testID="practice-button" onPress={practice} />
          <Text style={styles.instructions}>No screen nearby? Learn all four runes offline.</Text>
        </>}
        {phase === 'joining' && <View style={styles.card}><ActivityIndicator color={GOLD} /><Text style={styles.cardTitle}>Finding room {code}…</Text><Button title="Cancel" secondary onPress={leave} /></View>}
        {phase === 'ready' && <View style={styles.card}>
          <Text style={styles.live}>● WAND CONNECTED · {code}</Text><Text style={styles.cardTitle}>Point at the big screen.</Text>
          <Text style={styles.description}>Hold your phone comfortably, with its screen tilted toward you. This pose becomes your center.</Text>
          <Button title={motionBusy ? 'Enabling motion…' : 'Use motion wand'} disabled={motionBusy} onPress={() => { void startTilt(); }} />
          <Button title="Use touch controls" secondary onPress={() => { setMode('touch'); setPhase('playing'); setMotionNote(''); }} />
          <Button title="Leave room" secondary onPress={leave} />
        </View>}
        <View style={styles.footer}>
          <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(GAME_URL); }}><Text style={styles.link}>Open the game ↗</Text></Pressable>
          <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(GAME_URL + 'privacy.html'); }}><Text style={styles.link}>Privacy</Text></Pressable>
          <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(GAME_URL + 'support.html'); }}><Text style={styles.link}>Help</Text></Pressable>
        </View>
      </ScrollView> : <View style={styles.controller}>
        <View style={styles.topRow}>
          <View><Text style={styles.small}>{isPractice ? 'SPELL PRACTICE' : 'SCORE'}</Text><Text style={styles.score}>{isPractice ? `${practiceSpell + 1} / 4` : hud.score ?? 0}</Text></View>
          <View style={styles.topRight}>{!isPractice && <Text accessibilityLabel={`${lives} lives remaining`} style={styles.hearts}>{[0, 1, 2].map(i => i < lives ? '●' : '○').join(' ')}</Text>}
            <Pressable accessibilityRole="button" onPress={leave} hitSlop={12}><Text style={styles.link}>{isPractice ? 'Done' : 'Leave room'}</Text></Pressable></View>
        </View>
        <View style={styles.castHeader}><Text numberOfLines={2} style={styles.castTitle}>{castTitle}</Text>
          <Text style={styles.instructions}>{isPractice ? 'Draw the rune on the pad. Follow the arrow.' : mode === 'tilt' ? 'Hold the pad. Draw in the air. Release.' : 'Draw the rune on the pad. Lift to cast.'}</Text>
        </View>
        <View style={styles.padArea} onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          setPadSide(Math.max(80, Math.min(width, height, 300)));
        }}>
        <View testID="cast-pad" accessible accessibilityLabel={mode === 'tilt' && !isPractice ? 'Hold here while moving your phone to cast' : 'Draw a spell rune here'}
          style={[styles.pad, { width: padSide, height: padSide }, casting && styles.padActive]} onLayout={e => { padSize.current = e.nativeEvent.layout; }}
          onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={begin}
          onResponderMove={e => { if (mode === 'touch' || isPractice) touchPoint(e); }}
          onResponderRelease={() => release()} onResponderTerminate={() => release(true)} onResponderTerminationRequest={() => false}>
          <View pointerEvents="none" style={styles.padCenter}>
            {isPractice && !casting ? <Rune spell={SPELLS[practiceSpell]} size={98} /> : <><Text style={styles.padText}>{casting ? '✦' : mode === 'tilt' ? 'HOLD' : 'DRAW'}</Text><Text style={styles.small}>{casting ? 'RELEASE TO CAST' : 'YOUR SPELL STARTS HERE'}</Text></>}
          </View>
          <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
            <Polyline points={trace.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')} fill="none" stroke={GOLD} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View></View>
        <View style={styles.spellGrid}>{SPELLS.map((spell, index) => <Pressable key={spell.id} accessibilityRole="button" accessibilityLabel={`${spell.name}: ${spell.move}`}
          onPress={() => { if (isPractice) { setPracticeSpell(index); setTrace([]); setEcho(''); } else feedback(spell.name + ' · ' + spell.move); }}
          style={[styles.spellCard, isPractice && index === practiceSpell && styles.selectedCard]}><Rune spell={spell} size={34} /><Text style={[styles.spellName, { color: spell.color }]}>{spell.name}</Text><Text style={styles.spellMove}>{spell.move}</Text></Pressable>)}</View>
        {!isPractice && <View style={styles.controlRow}>
          <View style={{ flex: 1 }}><Button title={mode === 'tilt' ? 'Center wand' : 'Use motion'} secondary disabled={motionBusy} onPress={() => { release(true); if (mode === 'tilt') { centerWand(); feedback('Wand centered'); haptic(); } else void startTilt(); }} /></View>
          <View style={{ flex: 1 }}><Button title={status === 'playing' ? (mode === 'tilt' ? 'Use touch' : 'Leave room') : status === 'over' ? 'Play again' : 'Start game'}
            secondary={status === 'playing'} onPress={() => { if (status === 'playing') { if (mode === 'tilt') { release(true); setMode('touch'); } else leave(); } else controller.current?.command('start'); }} /></View>
        </View>}
        <Text style={styles.connection}>{isPractice ? 'OFFLINE PRACTICE · no room needed' : `● ROOM ${code} · ${mode.toUpperCase()}`}</Text>
        {!!motionNote && !isPractice && <Text style={styles.notice}>{motionNote}</Text>}
      </View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
    <Modal visible={scanner} animationType="slide" onRequestClose={() => setScanner(false)}>
      <View style={styles.root}>
        {scanner && foreground && permission?.granted && <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => scan(data)}
          onMountError={() => { setScanner(false); setError('The camera could not start. Enter the room code instead.'); }} />}
        <SafeAreaView pointerEvents="box-none" style={styles.scanOverlay}>
          <Text style={styles.scanTitle}>Find your big screen.</Text><Text style={styles.scanSubtitle}>Point at the QR shown by SpellsCast.</Text>
          <View pointerEvents="none" style={styles.scanFrame} />
          <Button title="Enter code instead" onPress={() => setScanner(false)} secondary />
        </SafeAreaView>
      </View>
    </Modal>
  </LinearGradient>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, safe: { flex: 1 },
  home: { padding: 24, paddingTop: 16, gap: 16, flexGrow: 1, maxWidth: 520, width: '100%', alignSelf: 'center' },
  wordmark: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: GOLD, fontSize: 13, fontWeight: '800', letterSpacing: 2.8 }, small: { color: DIM, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  hero: { alignItems: 'center', paddingVertical: 22, gap: 17 }, title: { fontSize: 33, lineHeight: 39, fontWeight: '800', color: '#faf4ff', textAlign: 'center', letterSpacing: -.8 },
  description: { color: '#b9afc7', fontSize: 15, lineHeight: 23, textAlign: 'center' },
  button: { minHeight: 52, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 15, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: '#211a2c', borderColor: '#42364f', borderWidth: 1 }, buttonText: { color: '#281b31', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  instructions: { color: DIM, fontSize: 12, lineHeight: 18, textAlign: 'center' }, divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 3 }, rule: { flex: 1, height: 1, backgroundColor: '#332a40' },
  codeRow: { flexDirection: 'row', gap: 12 }, codeInput: { flex: 1.2, minWidth: 0, width: 0, borderRadius: 14, borderWidth: 1, borderColor: '#493b58', color: '#fff', backgroundColor: '#16101f', fontSize: 24, letterSpacing: 5, textAlign: 'center', minHeight: 54, paddingHorizontal: 10 },
  error: { color: '#ffacb0', backgroundColor: '#341820', padding: 14, borderRadius: 12, fontSize: 13, lineHeight: 20 },
  card: { padding: 22, borderRadius: 22, borderWidth: 1, borderColor: '#493956', backgroundColor: '#1c1427', gap: 18 }, cardTitle: { color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 21 }, live: { color: '#94ddba', textAlign: 'center', fontSize: 11, letterSpacing: 1 },
  footer: { flexDirection: 'row', gap: 24, justifyContent: 'center', paddingVertical: 14 }, link: { color: '#bdb0d2', fontSize: 12, paddingVertical: 6 },
  controller: { flex: 1, padding: 16, paddingTop: 8, gap: 8, maxWidth: 540, width: '100%', alignSelf: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, topRight: { alignItems: 'flex-end', gap: 4 }, score: { color: '#fff', fontSize: 34, fontWeight: '900' }, hearts: { color: '#ff8588', fontSize: 22, letterSpacing: 5 },
  castHeader: { gap: 6, minHeight: 54, justifyContent: 'center' }, castTitle: { fontSize: 21, color: GOLD, fontWeight: '800', textAlign: 'center' },
  padArea: { flex: 1, minHeight: 110, alignItems: 'center', justifyContent: 'center' }, pad: { borderRadius: 36, borderWidth: 2, borderColor: '#6c5836', backgroundColor: '#1b1620', overflow: 'hidden' }, padActive: { borderColor: GOLD, backgroundColor: '#352739' },
  padCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 13 }, padText: { color: GOLD, fontSize: 32, fontWeight: '900', letterSpacing: 3 },
  spellGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, spellCard: { width: '48.5%', flexGrow: 1, alignItems: 'center', borderWidth: 1, borderColor: '#282031', borderRadius: 13, backgroundColor: '#17111f', paddingVertical: 8, paddingHorizontal: 5 }, selectedCard: { borderColor: '#9b8151', backgroundColor: '#2a2030' }, spellName: { fontSize: 12, fontWeight: '800', marginTop: 2 }, spellMove: { fontSize: 9, color: DIM, textAlign: 'center', marginTop: 3 },
  controlRow: { flexDirection: 'row', gap: 10 }, connection: { fontSize: 10, color: '#9ed9be', textAlign: 'center', letterSpacing: 1 }, notice: { color: '#c5b6cc', fontSize: 10, textAlign: 'center' },
  scanOverlay: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: '#0004', gap: 18 }, scanTitle: { color: '#fff', fontSize: 27, fontWeight: '800', textAlign: 'center' }, scanSubtitle: { color: '#fff', fontSize: 14, textAlign: 'center' }, scanFrame: { width: '100%', maxWidth: 330, alignSelf: 'center', aspectRatio: 1, borderRadius: 28, borderWidth: 3, borderColor: GOLD, marginVertical: 22 },
});
