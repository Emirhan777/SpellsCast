// Explicit network integration test; creates and removes one unused test room.
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getDatabase, get, ref, remove, set, runTransaction } from 'firebase/database';
import { firebaseConfig } from '../../firebase-config.js';
import { joinRoom } from '../src/controller';
import { reserveScreen } from '../src/launch';
import { claimLaunch } from '../../game/launch.js';
async function main() {
const app=initializeApp(firebaseConfig,'mobile-relay-test');
const db=getDatabase(app);
let code='', room:any, launchRoom:any, stopWatching:(()=>void)|undefined;
const sessions: Awaited<ReturnType<typeof joinRoom>>[]=[];
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
try {
 do {code=String(Math.floor(100000+Math.random()*900000));room=ref(db,'rooms/'+code);} while((await get(room)).exists());
 await set(room,{game:'spellscast',createdAt:Date.now(),status:'lobby'});
 let hud:any={},otherHud:any={},status='',closed='';
 const a=await joinRoom(code,{onHud:v=>hud=v,onStatus:v=>status=v,onClosed:v=>closed=v},new AbortController().signal);sessions.push(a);
 const b=await joinRoom(code,{onHud:v=>otherHud=v,onStatus(){},onClosed(){}},new AbortController().signal);sessions.push(b);
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
 const entries=Object.entries(value.players) as [string,{slot:number}][];
 const wizardA=entries.find(([,p])=>p.slot===0)![0], wizardB=entries.find(([,p])=>p.slot===1)![0];
 await set(ref(db,`rooms/${code}/hud`),{mode:'duel',score:7,timeLeft:30,matchReady:true,
  wizards:[{pid:wizardA,slot:0,score:2},{pid:wizardB,slot:1,score:5}],castPid:wizardB,spell:'Expel',castOk:true});
 await pause(300);
 assert.equal(hud.score,2);assert.equal(hud.opponentScore,5);assert.equal(hud.wizardNumber,1);
 assert.equal(hud.spell,'');assert.equal(otherHud.score,5);assert.equal(otherHud.spell,'Expel');
 assert.equal(otherHud.timeLeft,30);
 // A final movement inside the throttle must reach the real backend without a heartbeat.
 a.send({x:.25,y:.4}); a.send({x:.75,y:.6});
 await pause(200);
 assert.equal((Object.values((await get(ref(db,`rooms/${code}/input`))).val())[0] as any).x,.75);
 await remove(room);await pause(400);assert.match(closed,/closed/);
 const token='e'.repeat(32);
 const ticket=await reserveScreen(token,new AbortController().signal);
 launchRoom=ref(db,'rooms/'+ticket.code);
 let readyCount=0, failureCount=0;
 stopWatching=ticket.watch(()=>readyCount++,()=>failureCount++);
 const claim=await runTransaction(launchRoom,value=>value===null?null:claimLaunch(value,token),{applyLocally:false});
 assert.ok(claim.committed && claim.snapshot.exists());
 await pause(400); assert.equal(readyCount,1);
 await Promise.all(Array.from({length:20},(_,i)=>set(ref(db,`rooms/${ticket.code}/input/probe`),{x:i/20,y:.5,c:0,t:Date.now()})));
 await set(ref(db,`rooms/${ticket.code}/hud`),{score:20});
 await pause(200); assert.equal(readyCount,1,'pairing must not receive movement/HUD updates');
 await ticket.cancel(); assert.ok((await get(launchRoom)).exists(),'closing setup must preserve the claimed game');
 await remove(launchRoom); await pause(300); assert.equal(failureCount,1);
 console.log('PASS live relay: slots, capacity, cast release, final movement, personal duel scores and feedback, host closure, link pairing isolation and cleanup');
} finally {stopWatching?.();sessions.forEach(s=>s.destroy());if(room)await remove(room);if(launchRoom)await remove(launchRoom);await deleteApp(app);}
process.exit(0);
}
main().catch(error=>{console.error(error);process.exit(1);});
