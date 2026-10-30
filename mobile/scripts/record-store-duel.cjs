const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const folder = path.resolve('artifacts/screenshots');
const udid = fs.readFileSync(path.join(folder, 'device-udid.txt'), 'utf8').trim();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const hostLog = fs.openSync(path.join(folder, 'online-host.log'), 'w');
  const host = spawn(process.execPath, ['scripts/host-store-duel.cjs'], { stdio: ['ignore', hostLog, hostLog] });
  const roomFile = path.join(folder, 'online-room.json');
  const deadline = Date.now() + 60000;
  try {
    while (!fs.existsSync(roomFile) && Date.now() < deadline && host.exitCode === null) await delay(300);
    if (!fs.existsSync(roomFile)) throw new Error('Capture host did not create its room; check online-host.log');
    const { code: room } = JSON.parse(fs.readFileSync(roomFile, 'utf8'));
    const { SPELLS } = await import('../../game/spells.js');
    fs.writeFileSync(path.join(folder, 'spells.json'), JSON.stringify(SPELLS.map(s => ({ name: s.name, glyph: s.glyph }))));
    execFileSync('maestro', ['--device', udid, 'test', '-e', `CAPTURE_ROOM=${room}`, '--test-output-dir', 'artifacts/screenshots/online-setup', '.maestro/store-duel.yml'], { stdio: 'inherit' });
    const log = fs.openSync(path.join(folder, 'idb-companion.log'), 'w');
    const companion = spawn('idb_companion', ['--udid', udid, '--grpc-port', '10882'], { stdio: ['ignore', log, log] });
    let video;
    try {
      await delay(3000);
      const prefix = execFileSync('brew', ['--prefix', 'idb-cli'], { encoding: 'utf8' }).trim();
      video = spawn('xcrun', ['simctl', 'io', udid, 'recordVideo', '--codec=h264', '--mask=ignored', path.join(folder, 'online-duel-raw.mp4')], { stdio: ['ignore', 'ignore', 'inherit'] });
      await delay(1000);
      execFileSync(path.join(prefix, 'libexec/bin/python'), ['scripts/draw-store-spells.py', udid, '--duel'], { stdio: 'inherit' });
    } finally {
      if (video) {
        video.kill('SIGINT');
        await Promise.race([new Promise(resolve => video.once('exit', resolve)), delay(10000)]);
      }
      companion.kill('SIGTERM'); fs.closeSync(log);
    }
  } finally {
    fs.writeFileSync(path.join(folder, 'online-stop'), 'Capture finished');
    await Promise.race([new Promise(resolve => host.once('exit', resolve)), delay(15000)]);
    if (host.exitCode === null) host.kill('SIGTERM');
    fs.closeSync(hostLog);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
