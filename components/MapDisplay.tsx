'use client';

import React from 'react';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
  Blend,
  Circle,
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
  const borderStyle = isSelected ? '3px solid #d97706' : '2px solid #fef3c7';
  const size = isSelected ? '18px' : '14px';
  const shadow = isSelected
    ? '0 0 12px rgba(217, 119, 6, 0.4), 0 2px 8px rgba(101, 79, 60, 0.3)'
    : '0 2px 6px rgba(101, 79, 60, 0.2), 0 1px 3px rgba(101, 79, 60, 0.1)';

  return L.divIcon({
    html: `<span style="background-color: ${color}; width: ${size}; height: ${size}; border-radius: 50%; display: inline-block; border: ${borderStyle}; box-shadow: ${shadow}; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); transform: ${
      isSelected ? 'scale(1.1)' : 'scale(1)'
    };"></span>`,
    className: `custom-div-icon ${isSelected ? 'selected-marker-icon' : ''}`,
    iconSize: isSelected ? [18, 18] : [14, 14],
    iconAnchor: isSelected ? [9, 9] : [7, 7],
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

  const handleZoomIn = useCallback(() => {
    if (mapInstance.current) {
      mapInstance.current.zoomIn();
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (mapInstance.current) {
      mapInstance.current.zoomOut();
    }
  }, []);

  const handleResetView = useCallback(() => {
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
  }, []);

  const switchTileLayer = useCallback((layerKey: string) => {
    if (
      mapInstance.current &&
      TILE_LAYERS[layerKey as keyof typeof TILE_LAYERS]
    ) {
      const layer = TILE_LAYERS[layerKey as keyof typeof TILE_LAYERS];

      mapInstance.current.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          mapInstance.current?.removeLayer(layer);
        }
      });

      L.tileLayer(layer.url, {
        attribution: layer.attribution,
      }).addTo(mapInstance.current);

      setCurrentTileLayer(layerKey);
    }
  }, []);

  const toggleClustering = useCallback(() => {
    if (mapInstance.current && markerClusterGroup.current) {
      const markers = Object.values(markersRef.current);

      if (showClusters) {
        markerClusterGroup.current.clearLayers();
        markers.forEach((marker) => mapInstance.current?.addLayer(marker));
      } else {
        markers.forEach((marker) => mapInstance.current?.removeLayer(marker));
        markerClusterGroup.current.addLayers(markers);
      }

      setShowClusters(!showClusters);
    }
  }, [showClusters]);

  useEffect(() => {
    const totalPoints = points.length;
    const visiblePoints = Object.keys(markersRef.current).length;
    const categories = Object.keys(activeCategoryStyles).length;

    setMapStats({ totalPoints, visiblePoints, categories });
  }, [points, activeCategoryStyles]);

  const activeCategoryStylesMemo = useMemo(() => {
    if (!points || points.length === 0) {
      return {};
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
    return newStyles;
  }, [points]);

  useEffect(() => {
    setActiveCategoryStyles(activeCategoryStylesMemo);
  }, [activeCategoryStylesMemo]);

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    setIsMapLoading(true);

    mapInstance.current = L.map(mapContainer.current, {
      center: [20, 0],
      zoom: 2,
      attributionControl: false,
      zoomControl: false,
    });

    L.control
      .attribution({
        prefix: '<a href="https://leafletjs.com">Leaflet</a>',
        position: 'bottomleft',
      })
      .addTo(mapInstance.current);

    const initialLayer =
      TILE_LAYERS[currentTileLayer as keyof typeof TILE_LAYERS];
    L.tileLayer(initialLayer.url, {
      attribution: initialLayer.attribution,
    }).addTo(mapInstance.current);

    // @ts-ignore
    markerClusterGroup.current = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      removeOutsideVisibleBounds: true,
      animate: true,
      animateAddingMarkers: true,
      disableClusteringAtZoom: 18,
      iconCreateFunction: function (cluster: any) {
        const count = cluster.getChildCount();
        let size = 'small';
        let className = 'marker-cluster-small';

        if (count < 10) {
          size = 'small';
          className = 'marker-cluster-small';
        } else if (count < 100) {
          size = 'medium';
          className = 'marker-cluster-medium';
        } else {
          size = 'large';
          className = 'marker-cluster-large';
        }

        const iconSize = size === 'small' ? 40 : size === 'medium' ? 50 : 60;
        const fontSize =
          size === 'small' ? '12px' : size === 'medium' ? '14px' : '16px';

        return new L.DivIcon({
          html: `<div style="
            background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 50%, #e2e8f0 100%);
            border: 3px solid #475569;
            border-radius: 50%;
            width: ${iconSize}px;
            height: ${iconSize}px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: ${fontSize};
            color: #1e293b;
            box-shadow: 0 6px 20px rgba(71, 85, 105, 0.15), 0 3px 10px rgba(71, 85, 105, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: 'Inter', system-ui, sans-serif;
            position: relative;
          " class="cartographic-cluster">
            <div style="
              position: absolute;
              inset: 3px;
              background: linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.05) 100%);
              border-radius: 50%;
              pointer-events: none;
            "></div>
            <span style="position: relative; z-index: 1; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">${count}</span>
          </div>`,
          className: `marker-cluster ${className}`,
          iconSize: new L.Point(iconSize, iconSize),
          iconAnchor: [iconSize / 2, iconSize / 2],
        });
      },
    });

    mapInstance.current.addLayer(markerClusterGroup.current);

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
        div.style.backgroundColor = 'rgba(250, 250, 249, 0.95)';
        div.style.backdropFilter = 'blur(8px)';
        div.style.padding = '12px 16px';
        div.style.borderRadius = '12px';
        div.style.border = '1px solid rgba(231, 229, 228, 0.6)';
        div.style.boxShadow =
          '0 4px 12px rgba(101, 79, 60, 0.15), 0 2px 6px rgba(101, 79, 60, 0.1)';
        div.style.maxWidth = '200px';
        div.style.fontFamily = "'Inter', system-ui, sans-serif";
        div.style.marginBottom = '80px';

        const header = L.DomUtil.create('div', '', div);
        header.style.cursor = 'pointer';
        header.style.marginBottom = isLegendOpen ? '8px' : '0';
        header.style.fontWeight = '600';
        header.style.fontSize = '14px';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.color = '#57534e';
        header.style.letterSpacing = '0.025em';
        header.innerHTML = `<span>Categories</span><span style="font-size: 1.1em; color: #d97706; transition: transform 0.2s ease;">${
          isLegendOpen ? '&#9660;' : '&#9654;'
        }</span>`;

        const content = L.DomUtil.create('div', '', div);
        content.style.maxHeight = '160px';
        content.style.overflowY = 'auto';
        content.style.display = isLegendOpen ? 'block' : 'none';
        content.style.scrollbarWidth = 'thin';

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
            legendHtml += `<div style="display: flex; align-items: center; margin-bottom: 6px; padding: 4px 0; transition: background-color 0.2s ease; border-radius: 6px;" onmouseover="this.style.backgroundColor='rgba(245, 245, 244, 0.5)'" onmouseout="this.style.backgroundColor='transparent'">
              <span style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 8px; border: 2px solid #fef3c7; flex-shrink: 0; box-shadow: 0 2px 4px rgba(101, 79, 60, 0.2);"></span>
              <span style="font-size: 12px; word-break: break-word; color: #44403c; font-weight: 500;">${category}</span>
            </div>`;
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
      <div style="font-family: 'Inter', system-ui, sans-serif; font-size: 14px; max-width: 280px; color: #44403c;">
        <div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e7e5e4;">
          <strong style="display: block; margin-bottom: 4px; font-size: 16px; color: #1c1917; font-weight: 600; line-height: 1.3;">${
            point.originalName
          }</strong>
        </div>
        <div style="space-y: 6px;">
          <div style="margin-bottom: 6px;">
            <strong style="color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Category:</strong>
            <span style="margin-left: 6px; color: #57534e; font-weight: 500;">${
              point.category
            }</span>
          </div>
          <div style="margin-bottom: 6px;">
            <strong style="color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Original:</strong>
            <span style="margin-left: 6px; color: #57534e; font-family: 'Source Code Pro', monospace; font-size: 13px; background: #f5f5f4; padding: 2px 4px; border-radius: 3px;">${
              point.originalCoords
            }</span>
          </div>
          <div style="margin-bottom: 0;">
            <strong style="color: #78716c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Coordinates:</strong>
            <span style="margin-left: 6px; color: #57534e; font-family: 'Source Code Pro', monospace; font-size: 13px; background: #f5f5f4; padding: 2px 4px; border-radius: 3px;">${point.latitude.toFixed(
              4,
            )}, ${point.longitude.toFixed(4)}</span>
          </div>
        </div>
      </div>
    `);
      marker.bindTooltip(`${point.originalName} (${point.category})`, {
        direction: 'top',
        offset: [0, -10],
        className: 'cartographic-tooltip',
        opacity: 0.95,
      });
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
      {isMapLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-amber-50 to-stone-100 z-[1050] flex items-center justify-center">
          <div className="text-center space-y-6">
            <div className="relative">
              <Globe className="h-16 w-16 text-amber-600 mx-auto animate-pulse" />
              <Loader2 className="absolute inset-0 h-16 w-16 text-amber-500 animate-spin" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-serif font-semibold text-stone-800 tracking-wide">
                Initializing Cartographic View
              </h3>
              <p className="text-sm text-stone-600 font-medium">
                Loading geographic visualization system...
              </p>
            </div>
          </div>
        </div>
      )}

      <div ref={mapContainer} className="w-full h-full" />

      {isMapInitialized && !isMapLoading && (
        <>
          <div className="absolute top-4 left-4 z-[1040] flex items-center space-x-3">
            <div className="bg-stone-50/95 backdrop-blur-sm rounded-xl cartographic-shadow px-4 py-3 border border-stone-200/60">
              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-amber-700" />
                  <span className="font-semibold text-stone-700">
                    {mapStats.visiblePoints}
                  </span>
                  <span className="text-stone-500 font-medium">points</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Layers className="h-4 w-4 text-amber-700" />
                  <span className="font-semibold text-stone-700">
                    {mapStats.categories}
                  </span>
                  <span className="text-stone-500 font-medium">categories</span>
                </div>
              </div>
            </div>

            <div className="bg-stone-50/95 backdrop-blur-sm rounded-xl cartographic-shadow border border-stone-200/60 overflow-hidden">
              <div className="flex">
                {Object.entries(TILE_LAYERS).map(([key, layer]) => (
                  <button
                    key={key}
                    onClick={() => switchTileLayer(key)}
                    className={`px-4 py-3 text-xs font-semibold transition-all duration-200 ${
                      currentTileLayer === key
                        ? 'bg-amber-600 text-amber-50 shadow-sm'
                        : 'text-stone-600 hover:text-stone-800 hover:bg-stone-100/60'
                    }`}
                    title={`Switch to ${layer.name}`}
                  >
                    {layer.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute top-4 right-4 z-[1040] flex flex-col space-y-3">
            <div className="bg-stone-50/95 backdrop-blur-sm rounded-xl cartographic-shadow border border-stone-200/60 overflow-hidden">
              <div className="flex flex-col">
                <button
                  onClick={handleZoomIn}
                  className="p-3 text-stone-600 hover:text-stone-800 hover:bg-stone-100/60 transition-all duration-200 border-b border-stone-200/60"
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-3 text-stone-600 hover:text-stone-800 hover:bg-stone-100/60 transition-all duration-200 border-b border-stone-200/60"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  onClick={handleResetView}
                  className="p-3 text-stone-600 hover:text-stone-800 hover:bg-stone-100/60 transition-all duration-200"
                  title="Reset View"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="bg-stone-50/95 backdrop-blur-sm rounded-xl cartographic-shadow border border-stone-200/60 overflow-hidden">
              <button
                onClick={toggleClustering}
                className={`p-3 transition-all duration-200 ${
                  showClusters
                    ? 'text-amber-700 bg-amber-100/60'
                    : 'text-stone-600 hover:text-stone-800 hover:bg-stone-100/60'
                }`}
                title={
                  showClusters ? 'Disable Clustering' : 'Enable Clustering'
                }
              >
                {showClusters ? (
                  <Blend className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {points.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 z-[1040]">
              <div className="bg-stone-50/95 backdrop-blur-sm rounded-xl cartographic-shadow px-6 py-3 border border-stone-200/60">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <Navigation className="h-4 w-4 text-amber-700" />
                      <span className="text-stone-700 font-medium">
                        {
                          TILE_LAYERS[
                            currentTileLayer as keyof typeof TILE_LAYERS
                          ].name
                        }{' '}
                        View
                      </span>
                    </div>
                    <div className="h-4 w-px bg-stone-300/80" />
                    <div className="text-stone-600 font-medium">
                      {showClusters ? 'Clustered' : 'Individual'} markers
                    </div>
                  </div>
                  <div className="text-stone-500 font-medium">
                    Click markers for details • Drag to explore
                  </div>
                </div>
              </div>
            </div>
          )}

          {points.length === 0 && !isMapLoading && (
            <div className="absolute inset-0 bg-stone-100/60 z-[1030] flex items-center justify-center">
              <div className="bg-stone-50/95 backdrop-blur-sm p-10 rounded-2xl cartographic-shadow text-center space-y-6 max-w-md mx-4 border border-stone-200/60">
                <div className="p-4 bg-amber-100/60 rounded-2xl w-fit mx-auto">
                  <MapPin className="h-10 w-10 text-amber-700" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-serif font-semibold text-stone-800 tracking-wide">
                    No Geographic Data
                  </h3>
                  <p className="text-sm text-stone-600 font-medium leading-relaxed">
                    Add coordinate data to visualize locations on this
                    cartographic interface.
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

export default React.memo(MapDisplay);
