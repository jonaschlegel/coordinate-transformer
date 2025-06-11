#!/usr/bin/env node

import fs from 'fs';

// Coordinate parsing logic
function dmsToDecimal(dmsStr) {
  const parts = dmsStr.split('-').map((s) => parseFloat(s.trim()));
  if (parts.some(isNaN)) {
    return NaN;
  }
  let decimalDegrees = 0;
  if (parts.length >= 1) decimalDegrees += parts[0];
  if (parts.length >= 2) decimalDegrees += parts[1] / 60;
  if (parts.length >= 3) decimalDegrees += parts[2] / 3600;
  return decimalDegrees;
}

function parseCoordinateEntry(coordPairStr) {
  if (
    !coordPairStr ||
    typeof coordPairStr !== 'string' ||
    coordPairStr.trim() === '' ||
    coordPairStr === '-' ||
    coordPairStr === '??'
  ) {
    return null;
  }

  const coordPair = coordPairStr.trim();
  const parts = coordPair.split('/');
  if (parts.length !== 2) {
    console.warn(`Unexpected coordinate format: ${coordPair}`);
    return null;
  }

  const [latPart, lonPart] = parts;
  const latMatch = latPart.match(/^(.+?)([NS])$/);
  const lonMatch = lonPart.match(/^(.+?)([EW])$/);

  if (!latMatch || !lonMatch) {
    console.warn(`Could not parse lat/lon from: ${coordPair}`);
    return null;
  }

  const [, latStr, latDir] = latMatch;
  const [, lonStr, lonDir] = lonMatch;

  const latVal = dmsToDecimal(latStr);
  const lonVal = dmsToDecimal(lonStr);

  if (isNaN(latVal) || isNaN(lonVal)) {
    console.warn(`Invalid lat/lon values: ${latStr}, ${lonStr}`);
    return null;
  }

  return {
    latitude: latDir === 'S' ? -latVal : latVal,
    longitude: lonDir === 'W' ? -lonVal : lonVal,
  };
}

// Load and analyze the data
const data = JSON.parse(fs.readFileSync('./public/points.json', 'utf-8'));

console.log('=== Data Analysis Report ===\n');
console.log(`Total records: ${data.length}`);

// Count records with coordinates
const recordsWithCoords = data.filter(
  (item) =>
    item['Coördinaten/Coordinates'] &&
    item['Coördinaten/Coordinates'] !== '-' &&
    item['Coördinaten/Coordinates'] !== '??',
);

console.log(`Records with coordinates: ${recordsWithCoords.length}`);

// Parse coordinates and count successful parsing
let validCoordinates = 0;
let coordinateErrors = 0;
const categories = {};

recordsWithCoords.forEach((item) => {
  const coordString = item['Coördinaten/Coordinates'];
  const category = item['Soortnaam/Category'] || 'Unknown';

  // Count categories
  categories[category] = (categories[category] || 0) + 1;

  // Try to parse coordinates
  if (coordString.includes('+')) {
    // Multiple coordinates
    const parts = coordString.split('+').map((s) => s.trim());
    for (const part of parts) {
      const parsed = parseCoordinateEntry(part);
      if (parsed) {
        validCoordinates++;
      } else {
        coordinateErrors++;
      }
    }
  } else {
    // Single coordinate
    const parsed = parseCoordinateEntry(coordString);
    if (parsed) {
      validCoordinates++;
    } else {
      coordinateErrors++;
    }
  }
});

console.log(`Valid coordinates parsed: ${validCoordinates}`);
console.log(`Coordinate parsing errors: ${coordinateErrors}`);
console.log(
  `Success rate: ${(
    (validCoordinates / (validCoordinates + coordinateErrors)) *
    100
  ).toFixed(1)}%`,
);

console.log('\n=== Categories ===');
const sortedCategories = Object.entries(categories)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 10);

sortedCategories.forEach(([category, count]) => {
  console.log(`${category}: ${count}`);
});

// Sample some coordinate parsing
console.log('\n=== Sample Coordinate Parsing ===');
const sampleWithCoords = recordsWithCoords.slice(0, 5);
sampleWithCoords.forEach((item) => {
  const coordString = item['Coördinaten/Coordinates'];
  const name = item['Oorspr. naam op de kaart/Original name on the map'];
  const parsed = parseCoordinateEntry(coordString);
  console.log(
    `${name}: ${coordString} -> ${
      parsed ? `${parsed.latitude}, ${parsed.longitude}` : 'Failed to parse'
    }`,
  );
});

console.log('\n=== Headers ===');
if (data.length > 0) {
  Object.keys(data[0]).forEach((header) => {
    console.log(`- ${header}`);
  });
}
