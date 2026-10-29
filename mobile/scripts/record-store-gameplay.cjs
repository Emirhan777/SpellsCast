// Runs only on the macOS capture worker. It never changes gameplay or scores.
const fs = require('node:fs');
const { execFileSync, spawn } = require('node:child_process');
const path = require('node:path');
const folder = path.resolve('artifacts/screenshots');
const udid = fs.readFileSync(path.join(folder, 'device-udid.txt'), 'utf8').trim();
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 8 * 1024 * 1024 });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const { SPELLS } = await import('../../game/spells.js');
  fs.writeFileSync(path.join(folder, 'spells.json'), JSON.stringify(SPELLS.map(s => ({ name: s.name, glyph: s.glyph }))));
  run('maestro', ['--device', udid, 'test', '--test-output-dir', 'artifacts/screenshots/gameplay-setup', '.maestro/gameplay-ready.yml']);
  const companionLog = fs.openSync(path.join(folder, 'idb-companion.log'), 'w');
  const companion = spawn('idb_companion', ['--udid', udid, '--grpc-port', '10882'], { stdio: ['ignore', companionLog, companionLog] });
  let recording;
  try {
    await delay(3000);
    const prefix = run('brew', ['--prefix', 'idb-cli']).trim();
    const python = path.join(prefix, 'libexec/bin/python');
    if (!fs.existsSync(python)) throw new Error('idb Python interpreter not found: ' + python);
    run('xcrun', ['simctl', 'io', udid, 'screenshot', '--type=png', path.join(folder, '08-finger-ready.png')]);
    recording = spawn('xcrun', ['simctl', 'io', udid, 'recordVideo', '--codec=h264', '--mask=ignored', path.join(folder, 'gameplay-raw.mp4')], { stdio: ['ignore', 'ignore', 'inherit'] });
    await delay(1500);
    run(python, ['scripts/draw-store-spells.py', udid]);
  } finally {
    if (recording) {
      recording.kill('SIGINT');
      await Promise.race([new Promise(resolve => recording.once('exit', resolve)), delay(10000)]);
    }
    companion.kill('SIGTERM'); fs.closeSync(companionLog);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
