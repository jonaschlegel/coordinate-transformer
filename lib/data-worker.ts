interface Point {
  id: string;
  latitude: number;
  longitude: number;
  originalName: string;
  category: string;
  originalCoords: string;
  rowData: Record<string, string>;
}

interface WorkerMessage {
  type: 'PROCESS_DATA' | 'FILTER_DATA' | 'PROGRESS' | 'COMPLETE' | 'ERROR';
  payload: any;
}

const coordinateCache = new Map<
  string,
  { latitude: number; longitude: number } | null
>();

function parseSingleCoordinateEntry(
  coordPairStr: string,
): { latitude: number; longitude: number } | null {
  if (
    !coordPairStr ||
    typeof coordPairStr !== 'string' ||
    coordPairStr.trim() === '' ||
    coordPairStr === '-' ||
    coordPairStr === '??'
  ) {
    return null;
  }

  if (coordinateCache.has(coordPairStr)) {
    return coordinateCache.get(coordPairStr)!;
  }

  const [latStrFull, lonStrFull] = coordPairStr.split('/');
  if (!latStrFull || !lonStrFull) {
    coordinateCache.set(coordPairStr, null);
    return null;
  }

  let latVal: number;
  let lonVal: number;
  const latMatch = latStrFull.trim().match(/^([\d.-]+)([NS])$/i);
  if (!latMatch) {
    coordinateCache.set(coordPairStr, null);
    return null;
  }

  const [, latNums, latDir] = latMatch;
  latVal = dmsToDecimal(latNums);
  if (latDir.toUpperCase() === 'S') latVal = -latVal;

  const lonMatch = lonStrFull.trim().match(/^([\d.-]+)([EW])$/i);
  if (!lonMatch) {
    coordinateCache.set(coordPairStr, null);
    return null;
  }

  const [, lonNums, lonDir] = lonMatch;
  lonVal = dmsToDecimal(lonNums);
  if (lonDir.toUpperCase() === 'W') lonVal = -lonVal;

  if (isNaN(latVal) || isNaN(lonVal)) {
    coordinateCache.set(coordPairStr, null);
    return null;
  }

  if (latVal < -90 || latVal > 90 || lonVal < -180 || lonVal > 180) {
    coordinateCache.set(coordPairStr, null);
    return null;
  }

  const result = { latitude: latVal, longitude: lonVal };
  coordinateCache.set(coordPairStr, result);
  return result;
}

function dmsToDecimal(dmsStr: string): number {
  const parts = dmsStr.split('-').map((s) => Number.parseFloat(s.trim()));
  if (parts.some(isNaN)) {
    return Number.NaN;
  }
  let decimalDegrees = 0;
  if (parts.length >= 1) decimalDegrees += parts[0];
  if (parts.length >= 2) decimalDegrees += parts[1] / 60;
  if (parts.length >= 3) decimalDegrees += parts[2] / 3600;
  return decimalDegrees;
}

async function processRawDataChunks(raw: any[]): Promise<Point[]> {
  const processed: Point[] = [];
  let idCounter = 0;
  const chunkSize = 100;

  for (let i = 0; i < raw.length; i += chunkSize) {
    const chunk = raw.slice(i, i + chunkSize);

    for (const row of chunk) {
      const coordString =
        row['Coördinaten/Coordinates'] ||
        row['Coördinaten\nCoordinates'] ||
        row['Coördinaten'] ||
        row['Coordinates'];
      const originalName =
        row['Oorspr. naam op de kaart/Original name on the map'] ||
        row['Oorspr. naam op de kaart\nOriginal name on the map'] ||
        row['Oorspr. naam op de kaart'] ||
        row['Original name on the map'] ||
        'N/A';
      const category =
        row['Soortnaam/Category'] ||
        row['Soortnaam\nCategory'] ||
        row['Soortnaam'] ||
        row['Category'] ||
        'Unknown';

      if (
        !coordString ||
        coordString.trim() === '' ||
        coordString === '-' ||
        coordString === '??'
      )
        continue;

      const coordParts = coordString.split('+').map((s: string) => s.trim());

      for (const part of coordParts) {
        if (part === '' || part === '-' || part === '??') continue;
        const parsedLocation = parseSingleCoordinateEntry(part);
        if (parsedLocation) {
          processed.push({
            id: `point-${idCounter++}`,
            latitude: parsedLocation.latitude,
            longitude: parsedLocation.longitude,
            originalName,
            category: category || 'Unknown',
            originalCoords: part,
            rowData: row,
          });
        }
      }
    }

    self.postMessage({
      type: 'progress',
      processed: Math.min(i + chunkSize, raw.length),
      total: raw.length,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return processed;
}

function optimizedFilter(
  points: Point[],
  categoryFilter: string,
  searchQuery: string,
  sortConfig?: { key: string; direction: 'asc' | 'desc' } | null,
): Point[] {
  let filtered = points;

  if (categoryFilter && categoryFilter !== '') {
    filtered = filtered.filter((point) => point.category === categoryFilter);
  }

  if (searchQuery && searchQuery.trim() !== '') {
    const query = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      (point) =>
        point.originalName.toLowerCase().includes(query) ||
        point.category.toLowerCase().includes(query) ||
        point.originalCoords.toLowerCase().includes(query),
    );
  }

  if (sortConfig) {
    filtered = [...filtered].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortConfig.key === 'Computed Latitude') {
        aVal = a.latitude;
        bVal = b.latitude;
      } else if (sortConfig.key === 'Computed Longitude') {
        aVal = a.longitude;
        bVal = b.longitude;
      } else if (sortConfig.key === 'Parsed Coordinate Segment') {
        aVal = a.originalCoords;
        bVal = b.originalCoords;
      } else {
        aVal = a.rowData[sortConfig.key] || '';
        bVal = b.rowData[sortConfig.key] || '';
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return filtered;
}

async function processRawDataInChunks(
  raw: any[],
  onProgress?: (progress: number) => void,
): Promise<Point[]> {
  const processed: Point[] = [];
  let idCounter = 0;
  const chunkSize = 50;

  for (let i = 0; i < raw.length; i += chunkSize) {
    const chunk = raw.slice(i, i + chunkSize);

    for (const row of chunk) {
      const coordString =
        row['Coördinaten/Coordinates'] ||
        row['Coördinaten\nCoordinates'] ||
        row['Coördinaten'] ||
        row['Coordinates'];
      const originalName =
        row['Oorspr. naam op de kaart/Original name on the map'] ||
        row['Oorspr. naam op de kaart\nOriginal name on the map'] ||
        row['Oorspr. naam op de kaart'] ||
        row['Original name on the map'] ||
        'N/A';
      const category =
        row['Soortnaam/Category'] ||
        row['Soortnaam\nCategory'] ||
        row['Soortnaam'] ||
        row['Category'] ||
        'Unknown';
      row['Category'] || 'Unknown';

      if (
        !coordString ||
        coordString.trim() === '' ||
        coordString === '-' ||
        coordString === '??'
      )
        continue;

      const coordParts = coordString.split('+').map((s: string) => s.trim());

      for (const part of coordParts) {
        if (part === '' || part === '-' || part === '??') continue;
        const parsedLocation = parseSingleCoordinateEntry(part);
        if (parsedLocation) {
          processed.push({
            id: `point-${idCounter++}`,
            latitude: parsedLocation.latitude,
            longitude: parsedLocation.longitude,
            originalName,
            category: category || 'Unknown',
            originalCoords: part,
            rowData: row,
          });
        }
      }
    }

    const progress = Math.min((i + chunkSize) / raw.length, 1);
    onProgress?.(progress);

    await new Promise((resolve) => setTimeout(resolve, 1));
  }

  return processed;
}

self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'PROCESS_DATA':
        const points = await processRawDataInChunks(
          payload.rawData,
          (progress) => {
            self.postMessage({
              type: 'PROGRESS',
              payload: { progress },
            });
          },
        );

        self.postMessage({
          type: 'COMPLETE',
          payload: { points },
        });
        break;

      case 'FILTER_DATA':
        const filteredPoints = optimizedFilter(
          payload.points,
          payload.categoryFilter,
          payload.searchQuery,
          payload.sortConfig,
        );

        self.postMessage({
          type: 'COMPLETE',
          payload: { points: filteredPoints },
        });
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      payload: {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

export {};
