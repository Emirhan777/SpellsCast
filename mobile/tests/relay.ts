// Explicit network integration test; creates and removes one unused test room.
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getDatabase, get, ref, remove, set } from 'firebase/database';
import { firebaseConfig } from '../../firebase-config.js';
import { joinRoom } from '../src/controller';
async function main() {
const app=initializeApp(firebaseConfig,'mobile-relay-test');
const db=getDatabase(app);
let code='', room:any;
const sessions: Awaited<ReturnType<typeof joinRoom>>[]=[];
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
try {
 do {code=String(Math.floor(100000+Math.random()*900000));room=ref(db,'rooms/'+code);} while((await get(room)).exists());
 await set(room,{game:'spellscast',createdAt:Date.now(),status:'lobby'});
 let hud:any={},status='',closed='';
 const a=await joinRoom(code,{onHud:v=>hud=v,onStatus:v=>status=v,onClosed:v=>closed=v},new AbortController().signal);sessions.push(a);
 const b=await joinRoom(code,{onHud(){},onStatus(){},onClosed(){}},new AbortController().signal);sessions.push(b);
 await assert.rejects(joinRoom(code,{onHud(){},onStatus(){},onClosed(){}},new AbortController().signal),/two wands/);
 a.send({x:.2,y:.3,cast:true});a.send({x:.8,y:.7,cast:false});a.command('start');
 await set(ref(db,`rooms/${code}/hud`),{score:25,lives:2,spell:'Banish',castOk:true});
 await set(ref(db,`rooms/${code}/status`),'playing');
 await pause(500);
 const value=(await get(room)).val();
 assert.deepEqual(Object.values(value.players).map((p:any)=>p.slot).sort(),[0,1]);
 assert.equal(Object.values(value.input).length,1);
 assert.equal((Object.values(value.input)[0] as any).c,0);
 assert.equal((Object.values(value.input)[0] as any).x,.8);
 assert.equal((Object.values(value.cmd)[0] as any).type,'start');
 assert.equal(hud.score,25);assert.equal(status,'playing');
 await remove(room);await pause(400);assert.match(closed,/closed/);
 console.log('PASS live relay: slots, capacity, cast release, command, HUD, status, host closure');
} finally {sessions.forEach(s=>s.destroy());if(room)await remove(room);await deleteApp(app);}
process.exit(0);
}
main().catch(error=>{console.error(error);process.exit(1);});
