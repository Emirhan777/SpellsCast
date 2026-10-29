const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const developer = execFileSync('xcode-select', ['-p'], { encoding: 'utf8' }).trim();
const udid = fs.readFileSync('artifacts/screenshots/device-udid.txt', 'utf8').trim();
const simulator = path.join(developer, 'Applications/Simulator.app');
const hub = path.join(path.dirname(developer), 'Applications/DeviceHub.app');
if (fs.existsSync(simulator)) {
  execFileSync('open', ['-a', simulator, '--args', '-CurrentDeviceUDID', udid], { stdio: 'inherit' });
} else if (fs.existsSync(hub)) {
  execFileSync('open', ['-a', hub, `devices://device/open?id=${encodeURIComponent(udid)}`], { stdio: 'inherit' });
} else {
  throw new Error('Neither Simulator nor Device Hub exists in the selected Xcode installation');
}
