import fs from 'fs';
import Papa from 'papaparse';

const csv = fs.readFileSync('./grote-atlas-I-index.csv', 'utf8');
const fixedCsv = csv
  .replace(/\r?\n/g, '\n')
  .replace(/\n"/g, '"')
  .replace(/\n/g, '\n');
const parsed = Papa.parse(fixedCsv, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h) => h.replace(/\s*\/.*/, '').trim(),
});
fs.writeFileSync('./public/points.json', JSON.stringify(parsed.data, null, 2));
console.log('CSV converted to public/points.json');
