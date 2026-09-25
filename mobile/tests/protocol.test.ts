import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRoom, claimPlayer } from '../src/protocol';
import { createTracker } from '../../game/tilt.js';
import { SPELLS, recognize } from '../../game/spells.js';
import { createBlade } from '../../game/blade.js';

test('desktop QR, manual code and native deep links identify the same room', () => {
 for (const input of ['123456',' 123456 ', 'https://emirhan777.github.io/SpellsCast/play.html?room=123456', 'spellscast://join?room=123456']) assert.equal(parseRoom(input),'123456');
});
test('unrelated QR codes and ambiguous or invalid room IDs are rejected', () => {
 for (const input of ['', '12345','1234567','abcdef','https://example.com/?room=123456','https://emirhan777.github.io.evil.example/SpellsCast/play.html?room=123456','https://emirhan777.github.io/SpellsCast/play.html?room=123456&room=654321','spellscast://other?room=123456']) assert.throws(()=>parseRoom(input));
});
test('slot claims preserve players, fill gaps, and reject a third wand', () => {
 const first=claimPlayer(null,'a')!; assert.equal(first.a.slot,0);
 const second=claimPlayer(first,'b')!; assert.equal(second.b.slot,1); assert.deepEqual(second.a, first.a);
 assert.equal(claimPlayer(second,'c'),undefined);
 assert.equal(claimPlayer({b:{slot:1}},'c')!.c.slot,0);
 assert.deepEqual(claimPlayer(second,'a'),second);
});
test('native radians map to centered motion, correct directions and seamless yaw wrap', () => {
 const native = (yaw:number,pitch:number) => tracker.push(yaw*180/Math.PI,pitch*180/Math.PI)!;
 const tracker=createTracker();
 assert.deepEqual(native(3.13,.6),{x:.5,y:.5,vx:0,vy:0});
 const wrapped=native(-3.13,.6); assert.ok(Math.abs(wrapped.x-.5)<.02);
 tracker.center(); native(0,.6);
 assert.ok(native(.1,.6).x<.5); assert.ok(native(0,.7).y<.5);
 tracker.center(); assert.equal(native(.9,.8).x,.5);
});
test('practice uses the real recognizer and accepts all four spell shapes', () => {
 for (const spell of SPELLS) {
  const stroke: number[][] = [];
  for (let i=1;i<spell.glyph.length;i++) {
   const a=spell.glyph[i-1], b=spell.glyph[i];
   for(let j=0;j<10;j++) stroke.push([a[0]+(b[0]-a[0])*j/10,a[1]+(b[1]-a[1])*j/10]);
  }
  stroke.push(spell.glyph[spell.glyph.length-1]);
  assert.equal(recognize(stroke).spell?.id,spell.id);
 }
 assert.equal(recognize([[.5,.5],[.5001,.5001]]).spell,null);
});

test('touch casts start at the finger, regardless of the previous wand position', () => {
 for (const direct of [false, true]) {
  const blade = createBlade();
  const feed = (x: number, y: number, cast: boolean) => direct ? blade.feedDirect(x, y, cast) : blade.feed({x, y, cast});
  feed(.9, .9, false);
  blade.step(.016);
  const path = [[.22, .12], [.5, .88], [.78, .12]];
  feed(path[0][0], path[0][1], true);
  assert.deepEqual(blade.castPath![0], {x: .22, y: .12});
  for (let i = 1; i < path.length; i++) {
   const [ax, ay] = path[i - 1], [bx, by] = path[i];
   for (let j = 1; j <= 25; j++) {
    feed(ax + (bx - ax) * j / 25, ay + (by - ay) * j / 25, true);
    blade.step(.032);
   }
  }
  feed(.78, .12, false);
  assert.equal(recognize(blade.takeStroke()!.map((p: {x: number; y: number}) => [p.x, p.y])).spell?.id, 'expel');
 }
});
