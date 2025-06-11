'use client';

import {
  useEffect,
  useState,
  useTransition,
  useMemo,
  useRef,
  useCallback,
} from 'react';
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
import {
  Point,
  processRawData,
  createOptimizedFilter,
} from '@/lib/data-processing';
import { VirtualizedTable } from '@/components/VirtualizedTable';
import { DataWorkerClient } from '@/lib/data-worker-client';

const MapDisplay = dynamic(() => import('@/components/MapDisplay'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
      <div className="text-gray-600">Loading map...</div>
    </div>
  ),
});

const computeTableHeaders = (points: Point[]): string[] => {
  if (points.length === 0) return [];
  const specialHeaders = [
    'Computed Latitude',
    'Computed Longitude',
    'Parsed Coordinate Segment',
  ];
  const originalCsvHeaders = Object.keys(points[0].rowData);
  return [...originalCsvHeaders, ...specialHeaders];
};

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
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const workerRef = useRef<DataWorkerClient | null>(null);

  useEffect(() => {
    if (!workerRef.current) {
      try {
        workerRef.current = new DataWorkerClient();
      } catch (err) {
        console.warn(
          'Web Worker not available, falling back to main thread processing',
        );
      }
    }
    return () => {
      if (workerRef.current) {
        workerRef.current.destroy();
        workerRef.current = null;
      }
    };
  }, []);

  const loadData = useCallback(async () => {
    setError(null);
    setProcessingProgress(0);
    try {
      const assetBase =
        process.env.NEXT_PUBLIC_BASE_PATH || '/coordinate-transformer';
      const chunkCount = 12; // Update if you change the number of chunks
      let allRaw: any[] = [];
      for (let i = 1; i <= chunkCount; i++) {
        const res = await fetch(`${assetBase}/points-chunks/points-${i}.json`);
        if (!res.ok) throw new Error(`Failed to load chunk ${i}`);
        const chunk = await res.json();
        allRaw = allRaw.concat(chunk);
        setProcessingProgress((i / chunkCount) * 0.9); // Show progress up to 90%
      }
      let processed;
      if (workerRef.current) {
        processed = await workerRef.current.processRawData(allRaw, (progress) =>
          setProcessingProgress(0.9 + progress * 0.1),
        );
      } else {
        processed = await processRawData(allRaw);
      }
      setPoints(processed);
      setProcessingProgress(1);
    } catch (err) {
      setError('Failed to load points data');
      setPoints([]);
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      loadData();
    });
  }, [loadData]);

  const tableHeaders = useMemo(() => computeTableHeaders(points), [points]);

  const handlePointSelect = useCallback((pointId: string | null) => {
    setSelectedPointId(pointId);
  }, []);

  const handleRefresh = useCallback(() => {
    startTransition(() => {
      loadData();
    });
  }, [loadData]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategoryFilter('');
    setSelectedPointId(null);
    setSortConfig(null);
  }, []);

  const handleSort = useCallback((key: string) => {
    setSortConfig((prev) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (prev && prev.key === key && prev.direction === 'asc') {
        direction = 'desc';
      }
      return { key, direction };
    });
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, []);

  const getColumnDisplayName = useCallback((header: string): string => {
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
  }, []);

  const getCategoryColor = useCallback((category: string): string => {
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
  }, []);

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
    return createOptimizedFilter(
      points,
      selectedCategoryFilter,
      searchQuery,
      sortConfig,
    );
  }, [points, selectedCategoryFilter, searchQuery, sortConfig]);

  const handleExportVisible = useCallback(() => {
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
  }, [filteredPoints]);

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
                      {workerRef.current
                        ? 'Using Web Worker for processing'
                        : 'Processing on main thread'}
                    </div>
                    {processingProgress > 0 && processingProgress < 1 && (
                      <div className="w-48 mx-auto">
                        <div className="bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${processingProgress * 100}%` }}
                          />
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {Math.round(processingProgress * 100)}% complete
                        </div>
                      </div>
                    )}
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

                      {/* Virtualized Table */}
                      <div
                        className="overflow-x-auto w-full"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                      >
                        <div className="min-w-[900px]">
                          <VirtualizedTable
                            data={filteredPoints}
                            headers={tableHeaders}
                            selectedPointId={selectedPointId}
                            hoveredRowId={hoveredRowId}
                            onPointSelect={handlePointSelect}
                            onRowHover={setHoveredRowId}
                            getColumnDisplayName={getColumnDisplayName}
                            getCategoryColor={getCategoryColor}
                            copyToClipboard={copyToClipboard}
                            sortConfig={sortConfig}
                            onSort={handleSort}
                          />
                        </div>
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

        <style jsx global>{`
          .wider-table-row td {
            white-space: normal !important;
            word-break: break-word;
            min-width: 180px;
            max-width: 400px;
            padding-top: 0.75rem;
            padding-bottom: 0.75rem;
            font-size: 1.05rem;
          }
        `}</style>
      </div>
    </TooltipProvider>
  );
}
