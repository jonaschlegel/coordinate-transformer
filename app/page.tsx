'use client';

import { useEffect, useState, useTransition, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MapDisplay = dynamic(() => import('@/components/map-display'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
      <div className="text-gray-600">Loading map...</div>
    </div>
  ),
});

interface Point {
  id: string;
  latitude: number;
  longitude: number;
  originalName: string;
  category: string;
  originalCoords: string;
  rowData: Record<string, string>;
}

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
  const [latStrFull, lonStrFull] = coordPairStr.split('/');
  if (!latStrFull || !lonStrFull) return null;
  let latVal: number;
  let lonVal: number;
  const latMatch = latStrFull.trim().match(/^([\d.-]+)([NS])$/i);
  if (!latMatch) return null;
  const [, latNums, latDir] = latMatch;
  latVal = dmsToDecimal(latNums);
  if (latDir.toUpperCase() === 'S') latVal = -latVal;
  const lonMatch = lonStrFull.trim().match(/^([\d.-]+)([EW])$/i);
  if (!lonMatch) return null;
  const [, lonNums, lonDir] = lonMatch;
  lonVal = dmsToDecimal(lonNums);
  if (lonDir.toUpperCase() === 'W') lonVal = -lonVal;
  if (isNaN(latVal) || isNaN(lonVal)) return null;
  if (latVal < -90 || latVal > 90 || lonVal < -180 || lonVal > 180) return null;
  return { latitude: latVal, longitude: lonVal };
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

export default function HomePage() {
  const [points, setPoints] = useState<Point[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<string>('');

  useEffect(() => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch('/points.json');
        const raw = await res.json();
        let idCounter = 0;
        const processed: Point[] = [];
        for (const row of raw) {
          const coordString =
            row['Coördinaten/Coordinates'] ||
            row['Coördinaten\nCoordinates'] ||
            row['Coördinaten'] ||
            row['Coordinates'];
          const originalName =
            row['Oorspr. naam op de kaart/Original name on the map'] ||
            row['Oorspr. naam op de kaart'] ||
            row['Original name on the map'] ||
            'N/A';
          const category =
            row['Soortnaam/Category'] ||
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
          const coordParts = coordString
            .split('+')
            .map((s: string) => s.trim());
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
        setPoints(processed);
      } catch (err) {
        setError('Failed to load points.json');
        setPoints([]);
      }
    });
  }, []);

  const tableHeaders = useMemo(() => {
    if (points.length === 0) return [];
    const specialHeaders = [
      'Computed Latitude',
      'Computed Longitude',
      'Parsed Coordinate Segment',
    ];
    const originalCsvHeaders = Object.keys(points[0].rowData);
    return [...originalCsvHeaders, ...specialHeaders];
  }, [points]);

  const handlePointSelect = (pointId: string | null) => {
    setSelectedPointId(pointId);
  };

  useEffect(() => {
    if (selectedPointId && tableBodyRef.current) {
      const rowElement = tableBodyRef.current.querySelector(
        `[data-point-id="${selectedPointId}"]`,
      ) as HTMLElement;
      rowElement?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedPointId]);

  const uniqueCategoriesForFilter = useMemo(() => {
    if (points.length === 0) return [];
    const categories = new Set(points.map((point) => point.category));
    const sortedCategories = Array.from(categories).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return a.localeCompare(b);
    });
    return sortedCategories;
  }, [points]);

  const filteredPoints = useMemo(() => {
    let currentPoints = points;

    if (selectedCategoryFilter && selectedCategoryFilter !== 'all') {
      currentPoints = currentPoints.filter(
        (point) => point.category === selectedCategoryFilter,
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
    return currentPoints;
  }, [points, selectedCategoryFilter, searchQuery]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100">
      <main className="flex-grow flex flex-row overflow-hidden">
        {/* Left Panel */}
        <div className="w-2/5 p-4 flex flex-col space-y-4 border-r border-gray-300 bg-white overflow-hidden">
          <div className="flex-shrink-0 space-y-3 mb-4 p-3 bg-slate-50 rounded-md border border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="search-table"
                  className="block text-sm font-medium text-slate-600 mb-1"
                >
                  Search Table
                </label>
                <Input
                  id="search-table"
                  type="text"
                  placeholder="Search all fields..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                  disabled={isPending || points.length === 0}
                />
              </div>
              <div>
                <label
                  htmlFor="category-filter"
                  className="block text-sm font-medium text-slate-600 mb-1"
                >
                  Filter by Category
                </label>
                <Select
                  value={selectedCategoryFilter}
                  onValueChange={(value) => setSelectedCategoryFilter(value)}
                  disabled={isPending || points.length === 0}
                >
                  <SelectTrigger id="category-filter" className="w-full">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategoriesForFilter.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex-grow overflow-hidden flex flex-col">
            {!error &&
              (points.length > 0 || searchQuery || selectedCategoryFilter) &&
              !isPending && (
                <>
                  <h3 className="text-md font-semibold mb-2 text-slate-700">
                    Displaying {filteredPoints.length} (of {points.length}{' '}
                    total) from points.json
                  </h3>
                  <div className="flex-grow overflow-auto text-sm border border-gray-200 rounded">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          {tableHeaders.map((header) => (
                            <th
                              key={header}
                              className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                            >
                              {header.replace(/\n/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody
                        ref={tableBodyRef}
                        className="bg-white divide-y divide-gray-200"
                      >
                        {filteredPoints.map((point) => (
                          <tr
                            key={point.id}
                            data-point-id={point.id}
                            onClick={() => handlePointSelect(point.id)}
                            className={`cursor-pointer hover:bg-slate-50 ${
                              selectedPointId === point.id
                                ? 'bg-slate-200 ring-2 ring-slate-400'
                                : ''
                            }`}
                          >
                            {tableHeaders.map((header) => {
                              let cellValue: string | number = '';
                              if (header === 'Computed Latitude') {
                                cellValue = point.latitude.toFixed(4);
                              } else if (header === 'Computed Longitude') {
                                cellValue = point.longitude.toFixed(4);
                              } else if (
                                header === 'Parsed Coordinate Segment'
                              ) {
                                cellValue = point.originalCoords;
                              } else {
                                cellValue = point.rowData[header] || '';
                              }
                              return (
                                <td
                                  key={header}
                                  className="px-3 py-1.5 whitespace-nowrap truncate max-w-[200px]"
                                  title={String(cellValue)}
                                >
                                  {String(cellValue)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {points.length > 0 &&
                    filteredPoints.length === 0 &&
                    !isPending && (
                      <div className="p-3 mt-2 bg-sky-100 text-sky-700 rounded flex-grow flex items-center justify-center text-sm">
                        <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                        No data matches your current search or filter criteria.
                      </div>
                    )}
                </>
              )}
            {!error && points.length === 0 && !isPending && (
              <div className="p-3 bg-yellow-100 text-yellow-700 rounded flex-grow flex items-center justify-center text-sm">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                No points found in points.json. Check file format and column
                names.
              </div>
            )}
            {!isPending && !error && (
              <div className="p-3 text-gray-500 rounded flex-grow flex items-center justify-center text-sm">
                Loading data, please wait...
              </div>
            )}
            {isPending && points.length === 0 && (
              <div className="p-3 text-slate-600 rounded flex-grow flex items-center justify-center text-sm">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading data
                for table...
              </div>
            )}
          </div>
        </div>

        <div className="flex-grow h-full bg-gray-200">
          <MapDisplay
            points={filteredPoints}
            selectedPointId={selectedPointId}
            onPointSelect={handlePointSelect}
          />
        </div>
      </main>
    </div>
  );
}
