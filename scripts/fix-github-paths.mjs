#!/usr/bin/env node
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH;

if (basePath) {
  console.log(`Fixing static file paths for base path: ${basePath}`);

  const outDir = 'out';
  const baseDir = join(outDir, basePath.replace('/', ''));

  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }

  const filesToCopy = ['points.json', 'data-worker.js'];

  for (const file of filesToCopy) {
    const srcPath = join(outDir, file);
    const destPath = join(baseDir, file);

    if (existsSync(srcPath)) {
      copyFileSync(srcPath, destPath);
      console.log(`Copied ${file} to ${basePath}/${file}`);
    } else {
      console.warn(`Warning: ${file} not found in output directory`);
    }
  }

  console.log('Static file path fixing complete');
} else {
  console.log('No base path set, skipping static file path fixing');
}
