// A real web host and second player for native iOS App Store footage.
// Only normal UI input is used; gameplay, timing, targets and scores stay intact.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/tmp/spellscast-capture-tools/node_modules/playwright');
const folder = path.resolve('artifacts/screenshots');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const host = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const friend = await browser.newPage({ viewport: { width: 500, height: 900 } });
  try {
    await host.goto('https://emirhan777.github.io/SpellsCast/');
    await host.waitForFunction(() => window.__game?.host);
    await host.selectOption('#modeSelect', 'duel');
    await host.selectOption('#durationSelect', '120');
    const room = await host.evaluate(() => ({ code: window.__game.host.code, url: window.__game.host.joinUrl }));
    fs.writeFileSync(path.join(folder, 'online-room.json'), JSON.stringify(room));
    console.log('Live capture room: ' + room.code);
    await host.waitForFunction(() => window.__game.players.length === 1, null, { timeout: 120000 });
    console.log('Native iPhone joined');
    await delay(5000);
    await friend.goto(room.url);
    await friend.waitForFunction(() => !document.getElementById('playBtn').disabled);
    await friend.click('#playBtn');
    await host.waitForFunction(() => window.__game.players.length === 2);
    console.log('Second wizard joined');
    const { SPELLS } = await import('../../game/spells.js');
    const deadline = Date.now() + 180000;
    let index = 0;
    while (Date.now() < deadline && !fs.existsSync(path.join(folder, 'online-stop'))) {
      const state = await host.evaluate(() => window.__game.game.state);
      if (state !== 'playing') { await delay(300); continue; }
      const glyph = SPELLS[index++ % SPELLS.length].glyph;
      await friend.mouse.move(100 + glyph[0][0] * 300, 260 + glyph[0][1] * 300);
      await friend.mouse.down();
      for (let j = 1; j < glyph.length; j++) {
        const a = glyph[j - 1], b = glyph[j];
        const steps = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 15));
        for (let k = 1; k <= steps; k++) {
          await friend.mouse.move(100 + (a[0] + (b[0] - a[0]) * k / steps) * 300, 260 + (a[1] + (b[1] - a[1]) * k / steps) * 300);
          await delay(15);
        }
      }
      await friend.mouse.up();
      await delay(300);
    }
    await host.screenshot({ path: path.join(folder, 'online-host-evidence.png') });
  } finally {
    await host.evaluate(() => window.__game?.host?.destroy()).catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
