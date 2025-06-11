import fs from 'fs';

const inputPath = 'public/points.json';
const outputDir = 'public/points-chunks';
const chunkSize = 1000;

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
const totalChunks = Math.ceil(data.length / chunkSize);

for (let i = 0; i < totalChunks; i++) {
  const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);
  fs.writeFileSync(
    `${outputDir}/points-${i + 1}.json`,
    JSON.stringify(chunk, null, 2),
    'utf-8',
  );
}

console.log(`Split into ${totalChunks} chunks in ${outputDir}`);
