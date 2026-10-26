import assert from 'node:assert/strict';
import { test } from 'node:test';
import { playerInvite } from '../game/invite.js';
import { sharePlayerInvite } from '../game/share-invite.js';

test('invites use a controller URL without a screen launch token or duplicate room', () => {
  assert.equal(playerInvite('012345').url, 'https://emirhan777.github.io/SpellsCast/play.html?room=012345');
  assert.equal(playerInvite('012345', 'https://example.test/game/?room=654321#launch=secret').url,
    'https://example.test/game/play.html?room=012345');
  for (const code of ['', '12345', '1234567', '123456&room=654321']) assert.throws(() => playerInvite(code));
});

test('share, cancellation, clipboard and manual-copy fallback preserve the same invite', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const previousWindow = globalThis.window;
  const copied = [], shared = [], prompted = [];
  const nav = { share: async value => { shared.push(value); }, clipboard: { writeText: async value => { copied.push(value); } } };
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
  globalThis.window = { prompt: (...args) => prompted.push(args) };
  try {
    assert.equal(await sharePlayerInvite('123456'), '');
    assert.equal(shared[0].url, playerInvite('123456').url);
    nav.share = async () => { throw Object.assign(new Error('Dismissed'), { name: 'AbortError' }); };
    await sharePlayerInvite('123456');
    assert.equal(copied.length, 0, 'cancelling sharing must not silently copy anything');
    nav.share = async () => { throw new Error('Sharing unavailable'); };
    assert.match(await sharePlayerInvite('123456'), /copied/);
    assert.deepEqual(copied, [playerInvite('123456').url]);
    delete nav.share;
    nav.clipboard.writeText = async () => { throw new Error('Clipboard denied'); };
    await sharePlayerInvite('123456');
    assert.equal(prompted[0][1], playerInvite('123456').url);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous);
    else delete globalThis.navigator;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
