import fs from 'fs';
import Papa from 'papaparse';

const csv = fs.readFileSync('./grote-atlas-I-index.csv', 'utf8');

const lines = csv.split('\n');

const headerParts = [];
let headerLineCount = 0;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].match(/^\d+,/)) {
    headerLineCount = i;
    break;
  }
}

const headerLines = lines.slice(0, headerLineCount);
const reconstructedHeader =
  'Index page,"Oorspr. naam op de kaart/Original name on the map","Tegenwoordige naam/Present name","Soortnaam/Category","Coördinaten/Coordinates","Kaartvak/Map grid square","Kaart/Map","Pagina/Page"';

const dataLines = lines.slice(headerLineCount);
const fixedCsv = reconstructedHeader + '\n' + dataLines.join('\n');

const parsed = Papa.parse(fixedCsv, {
  header: true,
  skipEmptyLines: true,
  transform: (value) => {
    return typeof value === 'string' ? value.replace(/\n/g, ' ').trim() : value;
  },
});

if (parsed.errors.length > 0) {
  console.warn('CSV parsing errors:', parsed.errors.slice(0, 5));
}

const validData = parsed.data.filter((row) => {
  return (
    row &&
    typeof row === 'object' &&
    Object.values(row).some(
      (value) =>
        value &&
        value.toString().trim() !== '' &&
        value.toString().trim() !== '-',
    )
  );
});

console.log(
  `Found ${validData.length} valid records out of ${parsed.data.length} total rows`,
);

if (validData.length > 0) {
  console.log('Sample record:', JSON.stringify(validData[0], null, 2));
  console.log('Headers:', Object.keys(validData[0]));
}

fs.writeFileSync('./public/points.json', JSON.stringify(validData, null, 2));
console.log(`CSV converted to public/points.json`);
