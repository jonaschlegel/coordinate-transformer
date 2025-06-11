export interface Point {
  id: string;
  latitude: number;
  longitude: number;
  originalName: string;
  category: string;
  originalCoords: string;
  rowData: Record<string, string>;
}

const coordinateCache = new Map<
  string,
  { latitude: number; longitude: number } | null
>();

export function parseSingleCoordinateEntry(
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

export async function processRawData(raw: any[]): Promise<Point[]> {
  return new Promise((resolve) => {
    const processChunk = (startIndex: number, processed: Point[]) => {
      let idCounter = processed.length;
      const chunkSize = 100;
      const endIndex = Math.min(startIndex + chunkSize, raw.length);

      for (let i = startIndex; i < endIndex; i++) {
        const row = raw[i];
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

      if (endIndex < raw.length) {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => processChunk(endIndex, processed));
        } else {
          setTimeout(() => processChunk(endIndex, processed), 0);
        }
      } else {
        resolve(processed);
      }
    };

    processChunk(0, []);
  });
}

export function createOptimizedFilter(
  points: Point[],
  categoryFilter: string,
  searchQuery: string,
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null,
): Point[] {
  let currentPoints = points;

  if (categoryFilter && categoryFilter !== 'all') {
    currentPoints = currentPoints.filter(
      (point) => point.category === categoryFilter,
    );
  }

  if (searchQuery.trim() !== '') {
    const lowerCaseQuery = searchQuery.toLowerCase();
    currentPoints = currentPoints.filter((point) => {
      if (point.originalName?.toLowerCase().includes(lowerCaseQuery))
        return true;
      if (point.category?.toLowerCase().includes(lowerCaseQuery)) return true;
      if (point.originalCoords?.toLowerCase().includes(lowerCaseQuery))
        return true;

      return Object.values(point.rowData).some((value) =>
        String(value).toLowerCase().includes(lowerCaseQuery),
      );
    });
  }

  if (sortConfig) {
    currentPoints = [...currentPoints].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortConfig.key === 'Computed Latitude') {
        aValue = a.latitude;
        bValue = b.latitude;
      } else if (sortConfig.key === 'Computed Longitude') {
        aValue = a.longitude;
        bValue = b.longitude;
      } else if (sortConfig.key === 'Parsed Coordinate Segment') {
        aValue = a.originalCoords;
        bValue = b.originalCoords;
      } else {
        aValue = a.rowData[sortConfig.key] || '';
        bValue = b.rowData[sortConfig.key] || '';
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (sortConfig.direction === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }

  return currentPoints;
}
