import React, { useState } from 'react';
import { Modal, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { playerInvite } from '../../game/invite';

export default function InvitePlayer({ code, full, onInvite, onSharingChange }: {
  code: string; full: boolean; onInvite: () => void; onSharingChange: (sharing: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [showCopy, setShowCopy] = useState(false);
  const invite = playerInvite(code);

  async function share() {
    if (busy || full) return;
    setBusy(true); setNotice(''); setShowCopy(false);
    onSharingChange(true);
    try {
      onInvite();
      await Share.share(Platform.OS === 'ios'
        ? { title: invite.title, message: invite.text, url: invite.url }
        : { title: invite.title, message: `${invite.text}\n${invite.url}` });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setNotice('Sharing is unavailable here. Copy the invite link instead.');
      setShowCopy(true);
    } finally {
      onSharingChange(false); setBusy(false);
    }
  }
  async function copy() {
    try {
      const copied = await Clipboard.setStringAsync(invite.url);
      setNotice(copied ? 'Invite link copied. Send it to the second player.' : 'Select the link below to copy it.');
    } catch { setNotice('Select the link below to copy it.'); }
  }

  return <View style={styles.container}>
    <Pressable accessibilityRole="button" testID="invite-player-button" disabled={busy || full}
      onPress={() => { void share(); }}
      style={({ pressed }) => [styles.button, (pressed || busy || full) && { opacity: .55 }]}>
      <Text style={styles.label}>{full ? 'Both players connected' : busy ? 'Opening invite…' : 'Invite second player'}</Text>
    </Pressable>
    <Modal transparent visible={showCopy && !full} animationType="fade" onRequestClose={() => setShowCopy(false)}>
      <View style={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}>
        <Text accessibilityRole="header" style={styles.label}>Invite second player</Text>
        <Text accessibilityLiveRegion="polite" style={styles.note}>{notice}</Text>
        <Text selectable style={styles.note}>{invite.url}</Text>
        <Pressable accessibilityRole="button" onPress={() => { void copy(); }} style={styles.button}><Text style={styles.label}>Copy invite link</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setShowCopy(false)} style={styles.button}><Text style={styles.label}>Done</Text></Pressable>
      </View></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  overlay: { flex: 1, padding: 24, backgroundColor: '#000b', justifyContent: 'center', alignItems: 'center' },
  dialog: { padding: 20, gap: 16, width: '100%', maxWidth: 420, borderRadius: 20, borderWidth: 1, borderColor: '#68516f', backgroundColor: '#1c1427' },
  button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 13, borderWidth: 1, borderColor: '#68516f', backgroundColor: '#211a2c', alignItems: 'center', justifyContent: 'center' },
  label: { color: '#eed297', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  note: { color: '#b9afc7', fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
