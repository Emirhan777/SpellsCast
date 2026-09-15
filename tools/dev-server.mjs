// Static file server for local play.  npm start
//
// Deliberately dependency-free: `npx serve` downloads a package tree on first
// run and needs the network, which is exactly the wrong thing to rely on when
// you are stood in front of a TV trying to get a game up.
//
// Binds to 0.0.0.0 so phones on the same wifi can reach it. Note that phones
// still cannot use TILT over a plain http:// LAN address - browsers only hand
// out motion data on a secure origin - so `npm run tunnel` is what you want for
// a real phone. Over http the phone falls back to dragging a finger.

import { createServer } from "node:http";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { networkInterfaces } from "node:os";

const ROOT = resolve(process.argv[2] || ".");
const PORT = Number(process.env.PORT || process.argv[3] || 3000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (path.endsWith("/")) path += "index.html";
  // normalize() then strip any leading ../ so a crafted URL cannot escape ROOT
  const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end("forbidden"); return; }
  try {
    const fileStat = await stat(file);
    const contentType = TYPES[extname(file).toLowerCase()] || "application/octet-stream";
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileStat.size - 1;
      const chunksize = (end - start) + 1;
      const stream = createReadStream(file, { start, end });
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": contentType,
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileStat.size,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      });
      createReadStream(file).pipe(res);
    }
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("404 " + path);
  }
}).listen(PORT, "0.0.0.0", () => {
  const lan = Object.values(networkInterfaces()).flat()
    .filter((n) => n && n.family === "IPv4" && !n.internal)
    .map((n) => n.address);
  console.log("\n  SpellsCast\n");
  console.log("  big screen   http://localhost:" + PORT + "/");
  console.log("  mouse wand   http://localhost:" + PORT + "/?mouse=1");
  for (const ip of lan) console.log("  on this wifi http://" + ip + ":" + PORT + "/   (phone = touch only, no tilt)");
  console.log("\n  For tilt on a real phone you need https: npm run tunnel\n");
});
