import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const inputDir = path.resolve('public/products/generated');
const quality = 82;

const files = await fs.readdir(inputDir);
const pngFiles = files.filter((file) => file.toLowerCase().endsWith('.png'));

await Promise.all(
  pngFiles.map(async (file) => {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(inputDir, file.replace(/\.png$/i, '.webp'));

    await sharp(inputPath)
      .webp({
        effort: 6,
        quality,
      })
      .toFile(outputPath);

    const [inputStat, outputStat] = await Promise.all([fs.stat(inputPath), fs.stat(outputPath)]);
    const saved = Math.round((1 - outputStat.size / inputStat.size) * 100);
    console.log(`${file} -> ${path.basename(outputPath)} (${inputStat.size} -> ${outputStat.size}, ${saved}% saved)`);
  }),
);
