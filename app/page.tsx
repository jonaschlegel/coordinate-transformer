'use client';

import { useEffect, useState, useTransition, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Input } from '@/components/Input';
import {
  AlertCircle,
  Loader2,
  Map,
  Search,
  Filter,
  Info,
  BarChart3,
  Download,
  RefreshCw,
  MapPin,
  Globe,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Eye,
  Copy,
  ExternalLink,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/Select';
import { Button } from '@/components/Button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/Tooltip';

const MapDisplay = dynamic(() => import('@/components/MapDisplay'), {
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
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(
    new Set(),
  );

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
            row['Coördinaten\nCoordinates'] ||
            row['Coördinaten/Coordinates'] ||
            row['Coördinaten\nCoordinates'] ||
            row['Coördinaten'] ||
            row['Coordinates'];
          const originalName =
            row['Oorspr. naam op de kaart\nOriginal name on the map'] ||
            row['Oorspr. naam op de kaart/Original name on the map'] ||
            row['Oorspr. naam op de kaart'] ||
            row['Original name on the map'] ||
            'N/A';
          const category =
            row['Soortnaam\nCategory'] ||
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

  const handleRefresh = () => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch('/points.json?' + new Date().getTime());
        const raw = await res.json();
        let idCounter = 0;
        const processed: Point[] = [];
        for (const row of raw) {
          const coordString =
            row['Coördinaten\nCoordinates'] ||
            row['Coördinaten/Coordinates'] ||
            row['Coördinaten\nCoordinates'] ||
            row['Coördinaten'] ||
            row['Coordinates'];
          const originalName =
            row['Oorspr. naam op de kaart\nOriginal name on the map'] ||
            row['Oorspr. naam op de kaart/Original name on the map'] ||
            row['Oorspr. naam op de kaart'] ||
            row['Original name on the map'] ||
            'N/A';
          const category =
            row['Soortnaam\nCategory'] ||
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
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategoryFilter('');
    setSelectedPointId(null);
    setSortConfig(null);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'asc'
    ) {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const getColumnDisplayName = (header: string): string => {
    const displayNames: Record<string, string> = {
      'Computed Latitude': 'Latitude',
      'Computed Longitude': 'Longitude',
      'Parsed Coordinate Segment': 'Coordinates',
      'Oorspr. naam op de kaart\nOriginal name on the map': 'Original Name',
      'Soortnaam\nCategory': 'Category',
      'Tegenwoordige naam\nPresent name': 'Present Name',
      'Coördinaten\nCoordinates': 'Raw Coordinates',
      'Kaartvak\nMap grid square': 'Grid Square',
      'Kaart\nMap': 'Map',
      'Pagina\nPage': 'Page',
      'Index page': 'Index',
    };
    return displayNames[header] || header.replace(/\n/g, ' ');
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      'plaats/settlement': 'bg-blue-50 text-blue-800 border border-blue-200',
      'eiland/island': 'bg-amber-50 text-amber-800 border border-amber-200',
      'rivier/river':
        'bg-emerald-50 text-emerald-800 border border-emerald-200',
      'kaap/cape': 'bg-violet-50 text-violet-800 border border-violet-200',
      'landstreek/region': 'bg-stone-50 text-stone-800 border border-stone-200',
      'baai/bay': 'bg-cyan-50 text-cyan-800 border border-cyan-200',
      'berg/mountain': 'bg-rose-50 text-rose-800 border border-rose-200',
      'fort/fortress': 'bg-indigo-50 text-indigo-800 border border-indigo-200',
      'eilanden/islands':
        'bg-orange-50 text-orange-800 border border-orange-200',
      'ondiepte/shoals': 'bg-teal-50 text-teal-800 border border-teal-200',
      'zeestraat/strait': 'bg-sky-50 text-sky-800 border border-sky-200',
      'provincie/province':
        'bg-purple-50 text-purple-800 border border-purple-200',
      Unknown: 'bg-gray-50 text-gray-700 border border-gray-200',
    };
    return (
      colors[category] || 'bg-gray-50 text-gray-700 border border-gray-200'
    );
  };

  const handleExportVisible = () => {
    const dataToExport = filteredPoints.map((point) => ({
      name: point.originalName,
      category: point.category,
      latitude: point.latitude,
      longitude: point.longitude,
      originalCoords: point.originalCoords,
    }));

    const csvContent = [
      ['Name', 'Category', 'Latitude', 'Longitude', 'Original Coordinates'],
      ...dataToExport.map((point) => [
        point.name,
        point.category,
        point.latitude.toString(),
        point.longitude.toString(),
        point.originalCoords,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filtered-coordinates.csv';
    a.click();
    URL.revokeObjectURL(url);
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

    // Apply sorting
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

        // Handle numeric sorting
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc'
            ? aValue - bValue
            : bValue - aValue;
        }

        // Handle string sorting
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
  }, [points, selectedCategoryFilter, searchQuery, sortConfig]);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-gradient-to-br from-amber-50 via-stone-50 to-amber-100">
        {/* Header */}
        <header className="bg-white/95 backdrop-blur-sm border-b border-amber-200/50 shadow-sm cartographic-shadow px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl shadow-sm">
                <Map className="h-7 w-7 text-blue-700" />
              </div>
              <div>
                <h1 className="text-2xl font-serif font-semibold text-stone-800 tracking-wide">
                  Historical Atlas Explorer
                </h1>
                <p className="text-sm text-stone-600 font-medium tracking-wide">
                  Geographic Data Visualization & Cartographic Analysis
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {points.length > 0 && (
                <div className="hidden sm:flex items-center space-x-4 text-sm text-stone-600 bg-stone-100/60 px-3 py-2 rounded-lg border border-stone-200/50 cartographic-shadow">
                  <div className="flex items-center space-x-1">
                    <BarChart3 className="h-4 w-4 text-amber-700" />
                    <span className="font-medium">
                      {points.length} total points
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Filter className="h-4 w-4 text-amber-700" />
                    <span className="font-medium">
                      {filteredPoints.length} visible
                    </span>
                  </div>
                </div>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isPending}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh data</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        <main className="flex-grow flex flex-row overflow-hidden">
          {/* Left Panel */}
          <div className="w-2/5 flex flex-col bg-stone-50/50 border-r border-stone-200/60 cartographic-shadow">
            {/* Controls Section */}
            <div className="flex-shrink-0 p-4 bg-stone-100/40 border-b border-stone-200/60">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-serif font-semibold text-stone-800 flex items-center tracking-wide">
                    <Search className="h-5 w-5 mr-2 text-amber-700" />
                    Search & Filter
                  </h2>
                  {(searchQuery || selectedCategoryFilter) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="text-stone-600 hover:text-stone-800"
                    >
                      Clear all
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="search-table"
                      className="text-sm font-serif font-semibold text-stone-700 tracking-wide"
                    >
                      Search locations
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                      <Input
                        id="search-table"
                        type="text"
                        placeholder="Search names, categories, coordinates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-white/80 border-stone-300 focus:border-amber-400 focus:ring-amber-200"
                        disabled={isPending || points.length === 0}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="category-filter"
                      className="text-sm font-serif font-semibold text-stone-700 tracking-wide"
                    >
                      Filter by category
                    </label>
                    <Select
                      value={selectedCategoryFilter}
                      onValueChange={(value) =>
                        setSelectedCategoryFilter(value)
                      }
                      disabled={isPending || points.length === 0}
                    >
                      <SelectTrigger id="category-filter">
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {uniqueCategoriesForFilter.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {filteredPoints.length > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <div className="text-sm text-slate-600">
                      Showing{' '}
                      <span className="font-medium text-slate-800">
                        {filteredPoints.length}
                      </span>{' '}
                      of{' '}
                      <span className="font-medium text-slate-800">
                        {points.length}
                      </span>{' '}
                      locations
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportVisible}
                          disabled={filteredPoints.length === 0}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Export
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Export visible data as CSV
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>
            </div>

            {/* Data Table Section */}
            <div className="flex-grow overflow-hidden flex flex-col">
              {error && (
                <div className="p-4 bg-red-50 border-l-4 border-red-400 m-4">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                    <div>
                      <h3 className="text-sm font-medium text-red-800">
                        Error loading data
                      </h3>
                      <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {!error && isPending && points.length === 0 && (
                <div className="flex-grow flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                    <div className="text-slate-600">
                      Loading geographic data...
                    </div>
                    <div className="text-sm text-slate-500">
                      This may take a moment
                    </div>
                  </div>
                </div>
              )}

              {!error && points.length === 0 && !isPending && (
                <div className="flex-grow flex items-center justify-center p-6">
                  <div className="text-center space-y-3">
                    <div className="p-3 bg-yellow-100 rounded-full w-fit mx-auto">
                      <AlertCircle className="h-8 w-8 text-yellow-600" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-medium text-slate-800">
                        No data found
                      </h3>
                      <p className="text-sm text-slate-600">
                        No geographic coordinates were found in the data file.
                      </p>
                      <p className="text-xs text-slate-500">
                        Check that the file format and column names are correct.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!error && points.length > 0 && !isPending && (
                <>
                  {filteredPoints.length === 0 ? (
                    <div className="flex-grow flex items-center justify-center p-6">
                      <div className="text-center space-y-3">
                        <div className="p-3 bg-blue-100 rounded-full w-fit mx-auto">
                          <Search className="h-8 w-8 text-blue-600" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-lg font-medium text-slate-800">
                            No matches found
                          </h3>
                          <p className="text-sm text-slate-600">
                            Try adjusting your search or filter criteria.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearFilters}
                        >
                          Clear filters
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-grow overflow-hidden flex flex-col">
                      {/* Table Header with Controls */}
                      <div className="flex-shrink-0 px-4 py-3 bg-stone-50/80 border-b border-stone-200/60">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <BarChart3 className="h-4 w-4 text-amber-700" />
                            <span className="text-sm font-medium text-stone-700">
                              {filteredPoints.length} location
                              {filteredPoints.length !== 1 ? 's' : ''}
                            </span>
                            {sortConfig && (
                              <div className="flex items-center space-x-1 text-xs text-stone-500">
                                <span>•</span>
                                <span>
                                  Sorted by{' '}
                                  {getColumnDisplayName(sortConfig.key)}
                                </span>
                                {sortConfig.direction === 'asc' ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSortConfig(null)}
                            className="text-xs text-stone-500 hover:text-stone-700"
                            disabled={!sortConfig}
                          >
                            Clear sort
                          </Button>
                        </div>
                      </div>

                      {/* Enhanced Table */}
                      <div className="flex-grow overflow-auto">
                        <table className="min-w-full">
                          <thead className="bg-gradient-to-r from-stone-100/80 to-stone-200/60 sticky top-0 z-10 border-b border-stone-200/60">
                            <tr>
                              {tableHeaders.map((header) => (
                                <th
                                  key={header}
                                  className="group px-4 py-4 text-left cursor-pointer hover:bg-stone-200/40 transition-colors"
                                  onClick={() => handleSort(header)}
                                >
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                                      {getColumnDisplayName(header)}
                                    </span>
                                    <div className="flex flex-col">
                                      <ChevronUp
                                        className={`h-3 w-3 ${
                                          sortConfig?.key === header &&
                                          sortConfig.direction === 'asc'
                                            ? 'text-amber-700'
                                            : 'text-stone-400 group-hover:text-stone-500'
                                        }`}
                                      />
                                      <ChevronDown
                                        className={`h-3 w-3 -mt-1 ${
                                          sortConfig?.key === header &&
                                          sortConfig.direction === 'desc'
                                            ? 'text-amber-700'
                                            : 'text-stone-400 group-hover:text-stone-500'
                                        }`}
                                      />
                                    </div>
                                  </div>
                                </th>
                              ))}
                              <th className="w-12 px-2 py-4"></th>
                            </tr>
                          </thead>
                          <tbody ref={tableBodyRef} className="bg-white">
                            {filteredPoints.map((point, index) => (
                              <tr
                                key={point.id}
                                data-point-id={point.id}
                                onClick={() => handlePointSelect(point.id)}
                                onMouseEnter={() => setHoveredRowId(point.id)}
                                onMouseLeave={() => setHoveredRowId(null)}
                                className={`cursor-pointer transition-all duration-200 border-b border-stone-100/60 ${
                                  selectedPointId === point.id
                                    ? 'bg-amber-50/80 ring-2 ring-amber-300/60 ring-inset cartographic-shadow'
                                    : hoveredRowId === point.id
                                    ? 'bg-stone-50/80 cartographic-shadow'
                                    : index % 2 === 0
                                    ? 'bg-white/60'
                                    : 'bg-stone-25/40'
                                }`}
                              >
                                {tableHeaders.map((header) => {
                                  let cellValue: string | number = '';
                                  let isSpecialCell = false;

                                  if (header === 'Computed Latitude') {
                                    cellValue = point.latitude.toFixed(4);
                                    isSpecialCell = true;
                                  } else if (header === 'Computed Longitude') {
                                    cellValue = point.longitude.toFixed(4);
                                    isSpecialCell = true;
                                  } else if (
                                    header === 'Parsed Coordinate Segment'
                                  ) {
                                    cellValue = point.originalCoords;
                                    isSpecialCell = true;
                                  } else {
                                    cellValue = point.rowData[header] || '';
                                  }

                                  return (
                                    <td
                                      key={header}
                                      className="px-4 py-4 text-sm max-w-[200px]"
                                    >
                                      <div className="flex items-center space-x-2">
                                        {header === 'Soortnaam\nCategory' ? (
                                          <span
                                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                                              String(cellValue),
                                            )}`}
                                          >
                                            {String(cellValue)}
                                          </span>
                                        ) : header ===
                                          'Oorspr. naam op de kaart\nOriginal name on the map' ? (
                                          <div className="flex items-center space-x-2">
                                            <MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                            <span
                                              className="font-medium text-slate-900 truncate"
                                              title={String(cellValue)}
                                            >
                                              {String(cellValue)}
                                            </span>
                                          </div>
                                        ) : isSpecialCell ? (
                                          <div className="flex items-center space-x-2">
                                            <code className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-mono">
                                              {String(cellValue)}
                                            </code>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                copyToClipboard(
                                                  String(cellValue),
                                                );
                                              }}
                                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded transition-all"
                                              title="Copy to clipboard"
                                            >
                                              <Copy className="h-3 w-3 text-slate-500" />
                                            </button>
                                          </div>
                                        ) : header ===
                                            'Coördinaten\nCoordinates' &&
                                          cellValue &&
                                          cellValue !== '-' ? (
                                          <div className="flex items-center space-x-2">
                                            <Globe className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                            <span
                                              className="text-slate-700 truncate"
                                              title={String(cellValue)}
                                            >
                                              {String(cellValue)}
                                            </span>
                                          </div>
                                        ) : (
                                          <span
                                            className="text-slate-700 truncate block"
                                            title={String(cellValue)}
                                          >
                                            {String(cellValue) || (
                                              <span className="text-slate-400 italic">
                                                —
                                              </span>
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-4">
                                  <div className="flex items-center space-x-1">
                                    {selectedPointId === point.id && (
                                      <div className="flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-amber-600 rounded-full animate-pulse"></div>
                                        <span className="text-xs text-amber-700 font-medium">
                                          Selected
                                        </span>
                                      </div>
                                    )}
                                    {hoveredRowId === point.id &&
                                      selectedPointId !== point.id && (
                                        <Eye className="h-4 w-4 text-stone-400" />
                                      )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Table Footer */}
                      <div className="flex-shrink-0 px-4 py-3 bg-stone-100/60 border-t border-stone-200/60">
                        <div className="flex items-center justify-between text-sm text-stone-600">
                          <div className="flex items-center space-x-4">
                            <span>Click any row to view on map</span>
                            <div className="h-3 w-px bg-stone-300"></div>
                            <span>{filteredPoints.length} results</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs">
                              Tip: Click column headers to sort
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Map Section */}
          <div className="flex-grow h-full relative">
            {points.length > 0 && filteredPoints.length === 0 && !isPending && (
              <div className="absolute inset-0 bg-slate-100 bg-opacity-75 z-10 flex items-center justify-center">
                <div className="bg-white p-6 rounded-lg shadow-lg text-center space-y-3">
                  <Info className="h-8 w-8 text-blue-600 mx-auto" />
                  <div>
                    <h3 className="text-lg font-medium text-slate-800">
                      Map filtered
                    </h3>
                    <p className="text-sm text-slate-600">
                      No locations match your current filters.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearFilters}
                  >
                    Show all locations
                  </Button>
                </div>
              </div>
            )}
            <MapDisplay
              points={filteredPoints}
              selectedPointId={selectedPointId}
              onPointSelect={handlePointSelect}
            />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
