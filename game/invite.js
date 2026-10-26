// Invitations point at a controller in the existing room, never a host launch token.
export function playerInvite(code, baseUrl = 'https://emirhan777.github.io/SpellsCast/') {
  if (!/^\d{6}$/.test(code)) throw new Error('Connect to a game before inviting a player.');
  const url = new URL('play.html', baseUrl);
  url.searchParams.set('room', code);
  return {
    title: 'Join my SpellsCast game',
    text: `Join me as the second wizard in SpellsCast! Room ${code}. Open this link on your phone while our game screen stays open.`,
    url: url.href,
  };
}
