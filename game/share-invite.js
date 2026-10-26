import { playerInvite } from './invite.js';

export async function sharePlayerInvite(code, baseUrl) {
  const invite = playerInvite(code, baseUrl);
  if (navigator.share) {
    try {
      await navigator.share(invite);
      return '';
    } catch (error) {
      if (error.name === 'AbortError') return '';
    }
  }
  try {
    await navigator.clipboard.writeText(invite.url);
    return 'Invite link copied. Send it to the second player.';
  } catch {
    window.prompt('Copy this link and send it to the second player:', invite.url);
    return '';
  }
}
