const sharp = require('sharp');
async function run() {
  const bg = sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } });
  const overlay = await sharp({ create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } } }).png().toBuffer();
  try {
    await bg.composite([{ input: overlay, blend: 'over', opacity: 0.5 }]).png().toBuffer();
    console.log("opacity supported!");
  } catch (e) {
    console.log("opacity failed: " + e.message);
  }
}
run();
