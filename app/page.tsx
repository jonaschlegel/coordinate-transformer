'use client';

import type { ChangeEvent } from 'react';
import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { processUploadedCsv } from './actions';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Dynamically import MapDisplay to avoid SSR issues with Leaflet
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

export default function HomePage() {
  const [points, setPoints] = useState<Point[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<string>(''); // "" means all categories

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset filters and selected point on new file or file removal
    setSearchQuery('');
    setSelectedCategoryFilter('');
    setSelectedPointId(null);

    if (!file) {
      setPoints([]);
      setError(null);
      setFileName(null);
      setSelectedPointId(null);
      return;
    }
    setFileName(file.name);
    setError(null);
    setPoints([]);
    setSelectedPointId(null);
    startTransition(async () => {
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const text = e.target?.result as string;
          if (text) {
            const result = await processUploadedCsv(text);
            if (result.error) {
              setError(result.error);
              setPoints([]);
            } else {
              setPoints(result.points);
              setError(null);
            }
          } else {
            setError('Failed to read file content.');
            setPoints([]);
          }
        };
        reader.onerror = () => {
          setError('Error reading file.');
          setPoints([]);
        };
        reader.readAsText(file);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'An unknown error occurred during file processing.',
        );
        setPoints([]);
      }
    });
  };

  const tableHeaders = useMemo(() => {
    if (points.length === 0) return [];
    // Define our computed/special columns
    const specialHeaders = [
      'Computed Latitude',
      'Computed Longitude',
      'Parsed Coordinate Segment',
    ];
    // Get all original headers from the first point's rowData
    const originalCsvHeaders = Object.keys(points[0].rowData);
    // Concatenate with original CSV headers first, then special ones
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
    if (points.length === 0) return []; // Use original points to populate all possible categories
    const categories = new Set(points.map((point) => point.category));
    const sortedCategories = Array.from(categories).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return a.localeCompare(b);
    });
    // We will add "All Categories" directly in the Select component
    return sortedCategories;
  }, [points]);

  const filteredPoints = useMemo(() => {
    let currentPoints = points;

    if (selectedCategoryFilter && selectedCategoryFilter !== 'all') {
      // Check against "all"
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
      <header className="bg-slate-800 text-white shadow-md flex-shrink-0">
        <div className="px-4 py-3">
          <h1 className="text-2xl font-bold">Coordinate Mapper</h1>
        </div>
      </header>

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
                  onValueChange={(value) => setSelectedCategoryFilter(value)} // value will be "" for "All Categories"
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
          <div className="flex-shrink-0">
            <h2 className="text-lg font-semibold mb-2 text-slate-700">
              Upload CSV File
            </h2>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="max-w-xs"
                disabled={isPending}
              />
              {fileName && !isPending && (
                <span className="text-sm text-gray-600">
                  Selected: {fileName}
                </span>
              )}
            </div>
            {isPending && (
              <div className="mt-3 flex items-center text-slate-600">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing CSV...
              </div>
            )}
          </div>

          {error && (
            <div
              className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded flex items-start flex-shrink-0"
              role="alert"
            >
              <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="font-bold">Error:</strong>
                <span className="block sm:inline ml-1 text-sm">{error}</span>
              </div>
            </div>
          )}

          <div className="flex-grow overflow-hidden flex flex-col">
            {!error &&
              (points.length > 0 || searchQuery || selectedCategoryFilter) &&
              !isPending && (
                <>
                  <h3 className="text-md font-semibold text-slate-700 mb-2 flex-shrink-0">
                    Displaying {filteredPoints.length} (of {points.length}{' '}
                    total) from {fileName}
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
                                // This will now correctly access original CSV data first
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
            {!error && points.length === 0 && !isPending && fileName && (
              <div className="p-3 bg-yellow-100 text-yellow-700 rounded flex-grow flex items-center justify-center text-sm">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                No points extracted from {fileName}. Check file format and
                column names.
              </div>
            )}
            {!fileName && !isPending && !error && (
              <div className="p-3 text-gray-500 rounded flex-grow flex items-center justify-center text-sm">
                Select a CSV file to display locations and data.
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
