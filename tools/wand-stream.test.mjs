import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWandSender } from '../game/wand-stream.js';

function fixture() {
  let time = 0, id = 0;
  const timers = new Map(), sent = [];
  const sender = createWandSender(s => sent.push({ ...s, at: time }), {
    now: () => time,
    schedule: (fn, ms) => { timers.set(++id, { fn, at: time + ms }); return id; },
    cancel: key => timers.delete(key),
  });
  const advance = end => {
    for (;;) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      time = next[1].at; timers.delete(next[0]); next[1].fn();
    }
    time = end;
  };
  return { sender, sent, advance, timers };
}

test('the final movement arrives without waiting for another sensor event or heartbeat', () => {
  const {sender,sent,advance}=fixture();
  sender.send({x:.5,y:.5});
  advance(5); sender.send({x:.7,y:.6});
  advance(15); assert.equal(sent.length,1);
  advance(16); assert.equal(sent.length,2);
  assert.equal(sent[1].x,.7); assert.equal(sent[1].at,16);
});

test('fast sensors coalesce into one latest position, with a bounded timer queue', () => {
  const {sender,sent,advance,timers}=fixture();
  sender.send({x:0,y:0});
  for(let t=1;t<16;t++) { advance(t); sender.send({x:t/20,y:.4}); }
  assert.equal(timers.size,1);
  advance(16); assert.equal(sent.length,2); assert.equal(sent[1].x,.75);
});

test('press and release bypass the throttle and cannot be followed by a stale cast sample', () => {
  const {sender,sent,advance}=fixture();
  sender.send({x:.5,y:.5});
  advance(1); sender.send({x:.6,y:.5,cast:true});
  advance(2); sender.send({x:.7,y:.5,cast:true});
  advance(3); sender.send({x:.8,y:.5,cast:false});
  advance(100); assert.deepEqual(sent.map(s=>s.c),[0,1,0]);
  assert.equal(sent.at(-1).x,.8); assert.equal(sent.at(-1).at,3);
});

test('destroy cancels pending writes so leaving cannot recreate a removed player', () => {
  const {sender,sent,advance,timers}=fixture();
  sender.send({x:0,y:0}); advance(1); sender.send({x:1,y:1});
  sender.destroy(); advance(500); sender.send({x:1,y:1,cast:true});
  assert.equal(sent.length,1); assert.equal(timers.size,0);
});

test('out-and-back motion cancels the stale pending position; stationary samples stay quiet', () => {
  const {sender,sent,advance}=fixture();
  sender.send({x:.5,y:.5}); advance(1); sender.send({x:.7,y:.5});
  advance(2); sender.send({x:.5,y:.5}); advance(100);
  assert.equal(sent.length,1);
  advance(250); sender.send({x:.5,y:.5}); assert.equal(sent.length,2);
  sender.send({x:NaN,y:.5}); assert.equal(sent.length,2);
});
