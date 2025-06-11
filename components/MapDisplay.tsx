'use client';

import type React from 'react';
import { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  MapPin,
  Eye,
  EyeOff,
  Loader2,
  Globe,
  Navigation,
} from 'lucide-react';

interface PointData {
  id: string;
  latitude: number;
  longitude: number;
  originalName: string;
  originalCoords: string;
  category: string;
}

interface MapDisplayProps {
  points: PointData[];
  selectedPointId: string | null;
  onPointSelect: (pointId: string | null) => void;
}

const PREDEFINED_CATEGORY_COLORS: Record<string, string> = {
  'plaats/settlement': '#1f77b4',
  'eiland/island': '#ff7f0e',
  'rivier/river': '#2ca02c',
  'kaap/cape': '#9467bd',
  'landstreek/region': '#7f7f7f',
  'baai/bay': '#8c564b',
  'eilanden/islands': '#ff8c42',
  'fort/fortress': '#aec7e8',
  'berg/mountain': '#d62728',
  'ondiepte/shoals': '#98df8a',
  'zeestraat/strait': '#17becf',
  'provincie/province': '#c5b0d5',
  'rif/reef': '#ffbb78',
  'wijk/town district': '#bcbd22',
  'klip/cliff': '#8c564b',
  'schiereiland/peninsula': '#e377c2',
  'gebouw/building': '#ff9896',
  'inham/inlet': '#17becf',
  'lagune/lagoon': '#98df8a',
  'meer/lake': '#e377c2',
  'zee/sea': '#17becf',
  'fort/fortification': '#aec7e8',
  'weg/road': '#ffbb78',
  'bron/spring, well': '#98df8a',
  'klooster/monastery': '#ff9896',
  'ruïne/ruin': '#c5b0d5',
  unknown: '#bcbd22',
};

const TILE_LAYERS = {
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  },
  terrain: {
    name: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
  },
};

const DEFAULT_FALLBACK_COLOR = '#333333';

const createCategoryIcon = (color: string, isSelected?: boolean) => {
  const borderStyle = isSelected ? '3px solid #0ea5e9' : '1px solid white';
  const size = isSelected ? '16px' : '12px';
  const shadow = isSelected
    ? '0 0 8px rgba(14, 165, 233, 0.7)'
    : '0 0 2px rgba(0,0,0,0.5)';
  return L.divIcon({
    html: `<span style="background-color: ${color}; width: ${size}; height: ${size}; border-radius: 50%; display: inline-block; border: ${borderStyle}; box-shadow: ${shadow}; transition: all 0.2s ease-in-out;"></span>`,
    className: `custom-div-icon ${isSelected ? 'selected-marker-icon' : ''}`,
    iconSize: isSelected ? [16, 16] : [12, 12],
    iconAnchor: isSelected ? [8, 8] : [6, 6],
  });
};

if (typeof window !== 'undefined') {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

const MapDisplay: React.FC<MapDisplayProps> = ({
  points,
  selectedPointId,
  onPointSelect,
}) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerClusterGroup = useRef<L.MarkerClusterGroup | null>(null);
  const legendControl = useRef<L.Control | null>(null);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [currentTileLayer, setCurrentTileLayer] = useState('osm');
  const [showClusters, setShowClusters] = useState(true);
  const [mapStats, setMapStats] = useState({
    totalPoints: 0,
    visiblePoints: 0,
    categories: 0,
  });
  const markersRef = useRef<Record<string, L.Marker>>({});
  const [activeCategoryStyles, setActiveCategoryStyles] = useState<
    Record<string, { color: string }>
  >({});

  // Helper functions
  const handleZoomIn = () => {
    if (mapInstance.current) {
      mapInstance.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstance.current) {
      mapInstance.current.zoomOut();
    }
  };

  const handleResetView = () => {
    if (mapInstance.current && markerClusterGroup.current) {
      try {
        const bounds = markerClusterGroup.current.getBounds();
        if (bounds.isValid()) {
          mapInstance.current.fitBounds(bounds, {
            padding: [20, 20],
            maxZoom: 16,
          });
        } else {
          mapInstance.current.setView([20, 0], 2);
        }
      } catch (e) {
        mapInstance.current.setView([20, 0], 2);
      }
    }
  };

  const switchTileLayer = (layerKey: string) => {
    if (
      mapInstance.current &&
      TILE_LAYERS[layerKey as keyof typeof TILE_LAYERS]
    ) {
      const layer = TILE_LAYERS[layerKey as keyof typeof TILE_LAYERS];

      // Remove existing tile layers
      mapInstance.current.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          mapInstance.current?.removeLayer(layer);
        }
      });

      // Add new tile layer
      L.tileLayer(layer.url, {
        attribution: layer.attribution,
      }).addTo(mapInstance.current);

      setCurrentTileLayer(layerKey);
    }
  };

  const toggleClustering = () => {
    if (mapInstance.current && markerClusterGroup.current) {
      const markers = Object.values(markersRef.current);

      if (showClusters) {
        // Remove from cluster group and add directly to map
        markerClusterGroup.current.clearLayers();
        markers.forEach((marker) => mapInstance.current?.addLayer(marker));
      } else {
        // Remove from map and add to cluster group
        markers.forEach((marker) => mapInstance.current?.removeLayer(marker));
        markerClusterGroup.current.addLayers(markers);
      }

      setShowClusters(!showClusters);
    }
  };

  // Update map stats
  useEffect(() => {
    const totalPoints = points.length;
    const visiblePoints = Object.keys(markersRef.current).length;
    const categories = Object.keys(activeCategoryStyles).length;

    setMapStats({ totalPoints, visiblePoints, categories });
  }, [points, activeCategoryStyles]);

  useEffect(() => {
    if (!points || points.length === 0) {
      setActiveCategoryStyles({});
      return;
    }

    const uniqueCategories = Array.from(
      new Set(
        points.map((p) => (p.category && p.category.trim() ? p.category : '')),
      ),
    )
      .filter(Boolean)
      .sort();
    const newStyles: Record<string, { color: string }> = {};
    const usedColors = new Set<string>();

    uniqueCategories.forEach((category) => {
      const normalizedCategoryKey = category.toLowerCase();
      const predefinedColor = PREDEFINED_CATEGORY_COLORS[normalizedCategoryKey];
      if (predefinedColor && !usedColors.has(predefinedColor)) {
        newStyles[category] = { color: predefinedColor };
        usedColors.add(predefinedColor);
      }
    });

    let dynamicColorIndex = 0;
    uniqueCategories.forEach((category) => {
      if (!newStyles[category]) {
        let attempts = 0;
        let generatedColor;
        do {
          const hue = (dynamicColorIndex * 137.508 + attempts * 15) % 360;
          generatedColor = `hsl(${Math.floor(hue)}, 70%, 50%)`;
          attempts++;
        } while (usedColors.has(generatedColor) && attempts < 25);

        if (usedColors.has(generatedColor)) {
          generatedColor = `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`;
        }

        newStyles[category] = { color: generatedColor };
        usedColors.add(generatedColor);
        dynamicColorIndex++;
      }
    });
    setActiveCategoryStyles(newStyles);
  }, [points]);

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    setIsMapLoading(true);

    mapInstance.current = L.map(mapContainer.current, {
      center: [20, 0],
      zoom: 2,
      attributionControl: false,
      zoomControl: false, // We'll add custom controls
    });

    // Add attribution control in bottom left
    L.control
      .attribution({
        prefix: '<a href="https://leafletjs.com">Leaflet</a>',
        position: 'bottomleft',
      })
      .addTo(mapInstance.current);

    // Add initial tile layer
    const initialLayer =
      TILE_LAYERS[currentTileLayer as keyof typeof TILE_LAYERS];
    L.tileLayer(initialLayer.url, {
      attribution: initialLayer.attribution,
    }).addTo(mapInstance.current);

    // Initialize marker cluster group
    // @ts-ignore
    markerClusterGroup.current = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 60,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      removeOutsideVisibleBounds: true,
    });

    mapInstance.current.addLayer(markerClusterGroup.current);

    // Set loading to false after a short delay
    setTimeout(() => {
      setIsMapLoading(false);
      setIsMapInitialized(true);
    }, 500);

    return () => {
      if (legendControl.current && mapInstance.current)
        mapInstance.current.removeControl(legendControl.current);
      mapInstance.current?.remove();
      mapInstance.current = null;
      markerClusterGroup.current = null;
      setIsMapInitialized(false);
      setIsMapLoading(true);
    };
  }, []);

  useEffect(() => {
    if (!isMapInitialized || !mapInstance.current) return;
    const map = mapInstance.current;
    if (legendControl.current) map.removeControl(legendControl.current);

    const sortedCategories = Object.keys(activeCategoryStyles).sort();

    if (sortedCategories.length > 0) {
      const legend = new L.Control({ position: 'bottomright' });
      legend.onAdd = () => {
        const div = L.DomUtil.create(
          'div',
          'info legend leaflet-control-layers leaflet-control-layers-expanded',
        );
        div.style.backgroundColor = 'rgba(255,255,255,0.9)';
        div.style.padding = '6px 10px';
        div.style.borderRadius = '5px';
        div.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
        div.style.maxWidth = '180px';

        const header = L.DomUtil.create('div', '', div);
        header.style.cursor = 'pointer';
        header.style.marginBottom = isLegendOpen ? '6px' : '0';
        header.style.fontWeight = 'bold';
        header.style.fontSize = '13px';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.innerHTML = `<span>Legend</span><span style="font-size: 1.1em;">${
          isLegendOpen ? '&#9660;' : '&#9654;'
        }</span>`;

        const content = L.DomUtil.create('div', '', div);
        content.style.maxHeight = '120px';
        content.style.overflowY = 'auto';
        content.style.display = isLegendOpen ? 'block' : 'none';

        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        header.onclick = (e) => {
          e.stopPropagation();
          setIsLegendOpen(!isLegendOpen);
        };
        if (isLegendOpen) {
          let legendHtml = '';
          sortedCategories.forEach((category) => {
            const color =
              activeCategoryStyles[category]?.color || DEFAULT_FALLBACK_COLOR;
            legendHtml += `<div style="display: flex; align-items: center; margin-bottom: 3px;"><span style="background-color: ${color}; width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 6px; border: 1px solid #ccc; flex-shrink: 0; box-shadow: 0 0 1px rgba(0,0,0,0.3);"></span><span style="font-size: 11px; word-break: break-word;">${category}</span></div>`;
          });
          content.innerHTML = legendHtml;
        }
        return div;
      };
      legend.addTo(map);
      legendControl.current = legend;
    }
  }, [activeCategoryStyles, isMapInitialized, isLegendOpen, setIsLegendOpen]);

  useEffect(() => {
    if (
      !isMapInitialized ||
      !mapInstance.current ||
      !markerClusterGroup.current
    )
      return;
    const map = mapInstance.current;
    const currentMarkersGroup = markerClusterGroup.current;

    currentMarkersGroup.clearLayers();
    markersRef.current = {};

    const leafletMarkers: L.Marker[] = [];
    points.forEach((point) => {
      const isSelected = point.id === selectedPointId;
      const categoryStyle = activeCategoryStyles[point.category];
      const markerColor = categoryStyle?.color || DEFAULT_FALLBACK_COLOR;
      const icon = createCategoryIcon(markerColor, isSelected);

      const marker = L.marker([point.latitude, point.longitude], { icon });
      marker.on('click', () => onPointSelect(point.id));
      marker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 13px; max-width: 250px;">
        <strong style="display: block; margin-bottom: 3px; font-size: 14px;">${
          point.originalName
        }</strong>
        <strong>Category:</strong> ${point.category}<br>
        <strong>Original:</strong> ${point.originalCoords}<br>
        <strong>Coords:</strong> ${point.latitude.toFixed(
          4,
        )}, ${point.longitude.toFixed(4)}
      </div>
    `);
      marker.bindTooltip(`${point.originalName} (${point.category})`);
      markersRef.current[point.id] = marker;
      leafletMarkers.push(marker);
    });

    if (leafletMarkers.length > 0) {
      currentMarkersGroup.addLayers(leafletMarkers);
      if (
        points.length > 0 &&
        (!map.getBounds().contains(currentMarkersGroup.getBounds()) ||
          map.getZoom() < 3)
      ) {
        try {
          const bounds = currentMarkersGroup.getBounds();
          if (bounds.isValid())
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        } catch (e) {
          /* ignore */
        }
      }
    } else {
      map.setView([20, 0], 2);
    }
  }, [
    points,
    isMapInitialized,
    onPointSelect,
    selectedPointId,
    activeCategoryStyles,
  ]);

  const TARGET_SELECTION_ZOOM = 16;

  useEffect(() => {
    if (!isMapInitialized || !mapInstance.current) return;

    if (!selectedPointId) {
      mapInstance.current.closePopup();
      return;
    }

    const marker = markersRef.current[selectedPointId];
    const map = mapInstance.current;

    if (marker) {
      const targetLatLng = marker.getLatLng();

      const categoryStyle =
        activeCategoryStyles[
          marker.options.title ||
            points.find((p) => p.id === selectedPointId)?.category ||
            'Unknown'
        ];
      const markerColor = categoryStyle?.color || DEFAULT_FALLBACK_COLOR;
      marker.setIcon(createCategoryIcon(markerColor, true));

      if (markerClusterGroup.current) {
        // @ts-ignore
        markerClusterGroup.current.zoomToShowLayer(marker, () => {
          map.setView(targetLatLng, TARGET_SELECTION_ZOOM);
          if (!marker.isPopupOpen()) {
            marker.openPopup();
          }
        });
      } else {
        map.setView(targetLatLng, TARGET_SELECTION_ZOOM);
        if (!marker.isPopupOpen()) {
          marker.openPopup();
        }
      }
    }

    Object.values(markersRef.current).forEach((m) => {
      if (m !== marker) {
        const pointData = points.find((p) => markersRef.current[p.id] === m);
        if (pointData) {
          const catStyle = activeCategoryStyles[pointData.category];
          const color = catStyle?.color || DEFAULT_FALLBACK_COLOR;
          // @ts-ignore // Accessing custom property on marker if you stored it
          if (
            m.options.icon &&
            m.options.icon.options.className?.includes('selected-marker-icon')
          ) {
            m.setIcon(createCategoryIcon(color, false));
          }
        }
      }
    });
  }, [selectedPointId, isMapInitialized, activeCategoryStyles, points]);

  return (
    <div className="relative w-full h-full">
      {/* Loading Overlay */}
      {isMapLoading && (
        <div className="absolute inset-0 bg-slate-100 z-50 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="relative">
              <Globe className="h-12 w-12 text-blue-600 mx-auto animate-pulse" />
              <Loader2 className="absolute inset-0 h-12 w-12 text-blue-400 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-medium text-slate-800">
                Initializing Map
              </h3>
              <p className="text-sm text-slate-600">
                Loading geographic visualization...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Map Controls */}
      {isMapInitialized && !isMapLoading && (
        <>
          {/* Top Controls Bar */}
          <div className="absolute top-4 left-4 z-40 flex items-center space-x-2">
            {/* Map Stats */}
            <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 border border-white/20">
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-slate-700">
                    {mapStats.visiblePoints}
                  </span>
                  <span className="text-slate-500">points</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Layers className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium text-slate-700">
                    {mapStats.categories}
                  </span>
                  <span className="text-slate-500">categories</span>
                </div>
              </div>
            </div>

            {/* Layer Switcher */}
            <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-white/20 overflow-hidden">
              <div className="flex">
                {Object.entries(TILE_LAYERS).map(([key, layer]) => (
                  <button
                    key={key}
                    onClick={() => switchTileLayer(key)}
                    className={`px-3 py-2 text-xs font-medium transition-colors ${
                      currentTileLayer === key
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                    title={`Switch to ${layer.name}`}
                  >
                    {layer.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side Controls */}
          <div className="absolute top-4 right-4 z-40 flex flex-col space-y-2">
            {/* Zoom Controls */}
            <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-white/20 overflow-hidden">
              <div className="flex flex-col">
                <button
                  onClick={handleZoomIn}
                  className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors border-b border-slate-200"
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors border-b border-slate-200"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  onClick={handleResetView}
                  className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                  title="Reset View"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Clustering Toggle */}
            <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-white/20 overflow-hidden">
              <button
                onClick={toggleClustering}
                className={`p-2 transition-colors ${
                  showClusters
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                }`}
                title={
                  showClusters ? 'Disable Clustering' : 'Enable Clustering'
                }
              >
                {showClusters ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Bottom Status Bar */}
          {points.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 z-40">
              <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 border border-white/20">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <Navigation className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-600">
                        {
                          TILE_LAYERS[
                            currentTileLayer as keyof typeof TILE_LAYERS
                          ].name
                        }{' '}
                        View
                      </span>
                    </div>
                    <div className="h-4 w-px bg-slate-300" />
                    <div className="text-slate-600">
                      {showClusters ? 'Clustered' : 'Individual'} markers
                    </div>
                  </div>
                  <div className="text-slate-500">
                    Click markers for details • Drag to explore
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {points.length === 0 && !isMapLoading && (
            <div className="absolute inset-0 bg-slate-100/50 z-30 flex items-center justify-center">
              <div className="bg-white p-8 rounded-lg shadow-lg text-center space-y-4 max-w-md mx-4">
                <div className="p-3 bg-slate-100 rounded-full w-fit mx-auto">
                  <MapPin className="h-8 w-8 text-slate-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-slate-800">
                    No locations to display
                  </h3>
                  <p className="text-sm text-slate-600">
                    Add some geographic data to see points on the map.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MapDisplay;
