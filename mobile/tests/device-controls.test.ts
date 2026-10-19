import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nativeWandAngles, readDeviceBests } from '../src/device-controls';
import { createTracker } from '../../game/tilt.js';

test('device bests keep tilt and finger independent and reject invalid stored scores', () => {
  assert.deepEqual(readDeviceBests({ tilt: 100, finger: 30 }), { tilt: 100, finger: 30 });
  for (const bad of [null, '20', -1, Infinity, 1.2]) assert.deepEqual(readDeviceBests({ tilt: bad, finger: 40 }), { tilt: 0, finger: 40 });
  assert.deepEqual(readDeviceBests(null), { tilt: 0, finger: 0 });
});
test('landscape motion uses gamma for screen-up tilt, leaving portrait controls unchanged', () => {
  const tracker = createTracker();
  const p = (alpha: number, beta: number, gamma: number) => {
    const a = nativeWandAngles({ alpha, beta, gamma }, -90, true);
    const point = tracker.push(a.yaw, a.pitch); assert.ok(point); return point;
  };
  assert.equal(p(0, .2, -.4).y, .5);
  assert.ok(p(.1, .2, -.4).x < .5);
  assert.ok(p(0, .2, -.5).y < .5);
  tracker.center(); p(0, .2, -.4);
  assert.equal(p(0, .6, -.4).y, .5, 'portrait beta does not steer the landscape vertical axis');
  const portrait = nativeWandAngles({ alpha: .1, beta: .2, gamma: .3 }, 0);
  assert.equal(portrait.pitch, .2 * 180 / Math.PI);
  assert.equal(nativeWandAngles({ alpha: 0, beta: 0, gamma: .4 }, 90, true).pitch, .4 * 180 / Math.PI);
});
