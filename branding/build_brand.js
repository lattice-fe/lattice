// Regenerate Lattice raster brand assets from the SVG sources.
// Run from `sidecar/web` (which already has `sharp` as a dependency):
//   cd sidecar/web && node ../../branding/build_brand.js
const path = require("path");
const fs = require("fs");
// sharp lives in the sidecar web app's deps; resolve it relative to this file
// so the script runs from anywhere (`node branding/build_brand.js`).
const sharp = require(path.resolve(__dirname, "../sidecar/web/node_modules/sharp"));

const B = path.resolve(__dirname);
const ICON = B + "/lattice-icon.svg";
const MARK = B + "/lattice-mark.svg";
const SMALL = B + "/lattice-mark-small.svg";
const WORD = B + "/lattice-wordmark.svg";
const LOCK = B + "/lattice-lockup.svg";
const TRAY = B + "/lattice-tray.svg";

const png = (src, size, density) =>
  sharp(src, { density }).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png();
const buf = (src, size, density) => png(src, size, density).toBuffer();

// Minimal ICO writer that embeds PNG images (modern Windows/browsers read PNG-in-ICO).
function buildIco(entries) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  const parts = [head, dir];
  entries.forEach((e, i) => {
    const b = i * 16;
    const dim = e.size >= 256 ? 0 : e.size;
    dir.writeUInt8(dim, b + 0); dir.writeUInt8(dim, b + 1);
    dir.writeUInt16LE(1, b + 4); dir.writeUInt16LE(32, b + 6);
    dir.writeUInt32LE(e.buffer.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += e.buffer.length;
    parts.push(e.buffer);
  });
  return Buffer.concat(parts);
}

(async () => {
  await png(ICON, 1024, 200).toFile(B + "/icon-1024.png");
  await png(ICON, 512, 200).toFile(B + "/icon-512.png");
  await png(ICON, 256, 200).toFile(B + "/icon-256.png");
  await png(ICON, 180, 200).toFile(B + "/apple-touch-icon.png");

  await png(MARK, 48, 1024).toFile(B + "/favicon-48.png");
  await png(MARK, 32, 1024).toFile(B + "/favicon-32.png");
  await png(SMALL, 16, 1024).toFile(B + "/favicon-16.png");

  // tray icon (opaque squircle, decoded at runtime by the app)
  await png(TRAY, 64, 400).toFile(B + "/tray-64.png");
  await png(TRAY, 32, 400).toFile(B + "/tray-32.png");

  fs.writeFileSync(B + "/favicon.ico", buildIco([
    { size: 16, buffer: await buf(ICON, 16, 400) },
    { size: 32, buffer: await buf(ICON, 32, 400) },
    { size: 48, buffer: await buf(ICON, 48, 400) },
    { size: 256, buffer: await buf(ICON, 256, 200) },
  ]));

  await png(MARK, 512, 1024).toFile(B + "/mark-512.png");
  await sharp(WORD, { density: 400 }).resize(1024, null).png().toFile(B + "/wordmark-1024.png");
  await sharp(LOCK, { density: 400 }).resize(1024, null).png().toFile(B + "/lockup-1024.png");

  console.log("brand assets written to", B);
})().catch((e) => { console.error(e); process.exit(1); });
