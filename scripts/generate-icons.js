// Generate app icons from root-level myicon.png into images/icons/
// Requires: sharp

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.resolve(__dirname, '..', 'myicon.png');
const OUT_DIR = path.resolve(__dirname, '..', 'images', 'icons');
const SIZES = [16, 32, 180, 192, 256, 384, 512];

(async () => {
  try {
    if (!fs.existsSync(SRC)) {
      console.error('Source icon not found:', SRC);
      process.exit(1);
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await Promise.all(
      SIZES.map(async (size) => {
        const out = path.join(OUT_DIR, `icon-${size}.png`);
        await sharp(SRC)
          .resize(size, size, { fit: 'cover' })
          .png({ compressionLevel: 9, adaptiveFiltering: true })
          .toFile(out);
        console.log('Generated', out);
      })
    );
    console.log('All icons generated at', OUT_DIR);
  } catch (e) {
    console.error('Icon generation failed:', e);
    process.exit(1);
  }
})();
