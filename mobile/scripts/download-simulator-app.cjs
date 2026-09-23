const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
(async () => {
  const url = process.env.SCREENSHOT_APP_ARCHIVE_URL;
  if (!url || !url.startsWith('https://')) throw new Error('Set SCREENSHOT_APP_ARCHIVE_URL to an EAS iOS Simulator application archive.');
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not download simulator app: HTTP ' + response.status);
  fs.mkdirSync('artifacts/simulator-app', { recursive: true });
  fs.writeFileSync('artifacts/simulator-app.tar.gz', Buffer.from(await response.arrayBuffer()));
  execFileSync('tar', ['-xzf', 'artifacts/simulator-app.tar.gz', '-C', 'artifacts/simulator-app']);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
