const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
// Capture the final composited simulator screen after the orientation transition.
setTimeout(() => {
  const udid = fs.readFileSync('artifacts/screenshots/device-udid.txt', 'utf8').trim();
  execFileSync('xcrun', ['simctl', 'io', udid, 'screenshot', '--type=png', 'artifacts/screenshots/07-landscape-game.png'], { stdio: 'inherit' });
}, 3000);
