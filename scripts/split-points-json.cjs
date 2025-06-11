const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../public/points.json');
const outputDir = path.join(__dirname, '../public/points-chunks');
const chunkSize = 1000;

try {
  if (!fs.existsSync(inputPath)) {
    throw new Error('Input file does not exist: ' + inputPath);
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  const totalChunks = Math.ceil(data.length / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);
    fs.writeFileSync(
      path.join(outputDir, `points-${i + 1}.json`),
      JSON.stringify(chunk, null, 2),
      'utf-8',
    );
  }

  console.log(`Split into ${totalChunks} chunks in ${outputDir}`);
} catch (err) {
  console.error('Error splitting points.json:', err);
}
