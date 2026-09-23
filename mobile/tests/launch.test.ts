import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLaunch, claimLaunch, cancelLaunch } from '../../game/launch.js';

const token = 'a'.repeat(32);
const pending = () => ({ game: 'spellscast', createdAt: 100, status: 'waiting-screen', launch: { token, expiresAt: 1000 } });

test('launch links require an exact code and token; controller URLs cannot be launches', () => {
  assert.deepEqual(parseLaunch(`#launch=123456.${token}`), { code: '123456', token });
  for (const value of ['', '#room=123456', '#launch=../123456.' + token, '#launch=123456.short', '#launch=123456.' + token + '&room=654321']) assert.equal(parseLaunch(value), null);
});
test('only a matching, unexpired pending room can be claimed, exactly once', () => {
  const claimed = claimLaunch(pending(), token, 500)!;
  assert.equal(claimed.status, 'lobby'); assert.equal(claimed.launch.claimed, true);
  assert.equal(claimLaunch(claimed, token, 500), undefined);
  assert.equal(claimLaunch(pending(), 'b'.repeat(32), 500), undefined);
  assert.equal(claimLaunch(pending(), token, 1000), undefined);
  assert.equal(claimLaunch({ ...pending(), game: 'another-game' }, token, 500), undefined);
  assert.equal(claimLaunch(null, token, 500), undefined);
});
test('cancelling a pending link cannot delete an active or unrelated room', () => {
  assert.equal(cancelLaunch(pending(), token), null);
  assert.equal(cancelLaunch(claimLaunch(pending(), token, 500), token), undefined);
  assert.equal(cancelLaunch(pending(), 'b'.repeat(32)), undefined);
  assert.equal(cancelLaunch({ ...pending(), game: 'another-game' }, token), undefined);
});
