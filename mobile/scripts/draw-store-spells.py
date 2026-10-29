"""Replay real touch strokes in the simulator; no game state or score overrides."""
import asyncio
import json
import logging
import math
from pathlib import Path
import subprocess
import sys
from idb.grpc.client import Client
from idb.common.types import TCPAddress, HIDDelay, HIDDirection, HIDPress, HIDTouch, Point

folder = Path('artifacts/screenshots')
spells = json.loads((folder / 'spells.json').read_text())
udid = sys.argv[1]

def screenshot(name):
    subprocess.run(['xcrun', 'simctl', 'io', udid, 'screenshot', '--type=png', str(folder / name)], check=True)

async def draw(client, glyph, transform):
    # Uniform screen-space scale preserves the real rune's proportions.
    points = []
    for a, b in zip(glyph, glyph[1:]):
        steps = max(2, round(math.dist(a, b) * 26))
        points.extend((a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps) for i in range(steps))
    points.append(glyph[-1])
    events = []
    for x, y in points:
        px, py = transform(478 + (x - .5) * 240, 215 + (y - .5) * 240)
        action = HIDTouch(point=Point(x=px, y=py))
        events.extend([HIDPress(action=action, direction=HIDDirection.DOWN), HIDDelay(duration=.7 / len(points))])
    events.append(HIDPress(action=action, direction=HIDDirection.UP))
    await client.send_events(events)

async def main():
    async with Client.build(address=TCPAddress(host='127.0.0.1', port=10882), logger=logging.getLogger('capture')) as client:
        # idb reports simulator coordinates in its current orientation.
        transform = lambda x, y: (x, y)
        await draw(client, spells[0]['glyph'], transform)
        await asyncio.sleep(3.6)
        for i in range(36):
            spell = spells[i % len(spells)]
            await draw(client, spell['glyph'], transform)
            await asyncio.sleep(.12)
            if i in [3, 8, 14, 22, 30]:
                screenshot(f'gameplay-{i:02d}.png')
            print('Cast ' + spell['name'], flush=True)
        screenshot('gameplay-final.png')

asyncio.run(main())
