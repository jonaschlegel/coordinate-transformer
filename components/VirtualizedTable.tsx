import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Button } from './Button';
import { Eye, Copy, Globe } from 'lucide-react';

interface VirtualizedTableProps {
  data: any[];
  headers: string[];
  selectedPointId: string | null;
  hoveredRowId: string | null;
  onPointSelect: (pointId: string) => void;
  onRowHover: (pointId: string | null) => void;
  getColumnDisplayName: (header: string) => string;
  getCategoryColor: (category: string) => string;
  copyToClipboard: (text: string) => void;
  sortConfig?: { key: string; direction: 'asc' | 'desc' } | null;
  onSort?: (key: string) => void;
}

interface RowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    points: any[];
    headers: string[];
    selectedPointId: string | null;
    hoveredRowId: string | null;
    onPointSelect: (pointId: string) => void;
    onRowHover: (pointId: string | null) => void;
    getColumnDisplayName: (header: string) => string;
    getCategoryColor: (category: string) => string;
    copyToClipboard: (text: string) => void;
  };
}

const COLUMN_WIDTH = 200;

const TableRow = React.memo(({ index, style, data }: RowProps) => {
  const {
    points,
    headers,
    selectedPointId,
    hoveredRowId,
    onPointSelect,
    onRowHover,
    getCategoryColor,
    copyToClipboard,
  } = data;

  const point = points[index];

  const rowStyle = useMemo(
    () => ({
      ...style,
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s',
      backgroundColor:
        selectedPointId === point.id
          ? 'rgba(251, 191, 36, 0.1)'
          : hoveredRowId === point.id
          ? 'rgba(120, 113, 108, 0.05)'
          : index % 2 === 0
          ? 'rgba(255, 255, 255, 0.6)'
          : 'rgba(245, 245, 244, 0.4)',
      borderBottom: '1px solid rgba(231, 229, 228, 0.6)',
      borderLeft: selectedPointId === point.id ? '3px solid #d97706' : 'none',
    }),
    [style, selectedPointId, hoveredRowId, point.id, index],
  );

  return (
    <div
      style={rowStyle}
      onClick={() => onPointSelect(point.id)}
      onMouseEnter={() => onRowHover(point.id)}
      onMouseLeave={() => onRowHover(null)}
    >
      {headers.map((header) => {
        let cellValue: string | number = '';
        let isSpecialCell = false;

        if (header === 'Computed Latitude') {
          cellValue = point.latitude.toFixed(4);
          isSpecialCell = true;
        } else if (header === 'Computed Longitude') {
          cellValue = point.longitude.toFixed(4);
          isSpecialCell = true;
        } else if (header === 'Parsed Coordinate Segment') {
          cellValue = point.originalCoords;
          isSpecialCell = true;
        } else {
          cellValue =
            point.rowData &&
            Object.prototype.hasOwnProperty.call(point.rowData, header)
              ? point.rowData[header]
              : '';
        }

        return (
          <div
            key={header}
            style={{
              width: COLUMN_WIDTH,
              minWidth: COLUMN_WIDTH,
              maxWidth: COLUMN_WIDTH,
            }}
            className="px-4 py-2 text-sm overflow-hidden whitespace-nowrap text-ellipsis border-r border-stone-200/60"
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
              ) : isSpecialCell && header.includes('Latitude') ? (
                <div className="flex items-center space-x-2 group">
                  <span className="text-slate-700 font-mono text-xs">
                    {String(cellValue)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(String(cellValue));
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded transition-all"
                    title="Copy to clipboard"
                  >
                    <Copy className="h-3 w-3 text-slate-500" />
                  </Button>
                </div>
              ) : isSpecialCell && header.includes('Longitude') ? (
                <div className="flex items-center space-x-2 group">
                  <span className="text-slate-700 font-mono text-xs">
                    {String(cellValue)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(String(cellValue));
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded transition-all"
                    title="Copy to clipboard"
                  >
                    <Copy className="h-3 w-3 text-slate-500" />
                  </Button>
                </div>
              ) : header === 'Coördinaten\nCoordinates' &&
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
                    <span className="text-slate-400 italic">—</span>
                  )}
                </span>
              )}
            </div>
          </div>
        );
      })}
      <div className="w-12 px-2 py-2 flex items-center justify-center">
        {selectedPointId === point.id && (
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-amber-600 rounded-full animate-pulse"></div>
            <span className="text-xs text-amber-700 font-medium">Selected</span>
          </div>
        )}
        {hoveredRowId === point.id && selectedPointId !== point.id && (
          <Eye className="h-4 w-4 text-slate-400" />
        )}
      </div>
    </div>
  );
});

TableRow.displayName = 'TableRow';

export const VirtualizedTable = React.memo<VirtualizedTableProps>(
  ({
    data,
    headers,
    selectedPointId,
    hoveredRowId,
    onPointSelect,
    onRowHover,
    getColumnDisplayName,
    getCategoryColor,
    copyToClipboard,
    sortConfig,
    onSort,
  }) => {
    const sortedData = useMemo(() => {
      if (!selectedPointId) return data;
      const idx = data.findIndex((p) => p.id === selectedPointId);
      if (idx === -1) return data;
      return [data[idx], ...data.slice(0, idx), ...data.slice(idx + 1)];
    }, [data, selectedPointId]);

    const itemData = useMemo(
      () => ({
        points: sortedData,
        headers,
        selectedPointId,
        hoveredRowId,
        onPointSelect,
        onRowHover,
        getColumnDisplayName,
        getCategoryColor,
        copyToClipboard,
      }),
      [
        sortedData,
        headers,
        selectedPointId,
        hoveredRowId,
        onPointSelect,
        onRowHover,
        getColumnDisplayName,
        getCategoryColor,
        copyToClipboard,
      ],
    );

    return (
      <div className="flex-grow">
        <div className="sticky top-0 z-10 bg-gradient-to-r from-stone-100/80 to-stone-200/60 border-b border-stone-200/60">
          <div className="flex">
            {headers.map((header) => {
              const isSorted = sortConfig && sortConfig.key === header;
              const arrow = isSorted
                ? sortConfig.direction === 'asc'
                  ? '▲'
                  : '▼'
                : '';
              return (
                <div
                  key={header}
                  style={{
                    width: COLUMN_WIDTH,
                    minWidth: COLUMN_WIDTH,
                    maxWidth: COLUMN_WIDTH,
                    cursor: onSort ? 'pointer' : 'default',
                  }}
                  className="px-4 py-3 whitespace-nowrap overflow-hidden text-ellipsis border-r border-stone-200/60 select-none group"
                  onClick={onSort ? () => onSort(header) : undefined}
                  title={
                    onSort
                      ? `Sort by ${getColumnDisplayName(header)}`
                      : undefined
                  }
                >
                  <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1">
                    {getColumnDisplayName(header)}
                    <span
                      className={`transition-opacity duration-150 ${
                        isSorted
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-60'
                      }`}
                    >
                      {arrow}
                    </span>
                  </span>
                </div>
              );
            })}
            <div className="w-12 px-2 py-3"></div>
          </div>
        </div>

        <List
          height={400}
          width={headers.length * COLUMN_WIDTH + 48}
          itemCount={sortedData.length}
          itemSize={60}
          itemData={itemData}
          overscanCount={5}
        >
          {TableRow}
        </List>
      </div>
    );
  },
);

VirtualizedTable.displayName = 'VirtualizedTable';
