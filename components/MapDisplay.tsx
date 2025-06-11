'use client';

import type React from 'react';
import { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

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
  'rivier/river': '#2ca02c',
  'berg/mountain': '#d62728',
  'eiland/island': '#ff7f0e',
  'kaap/cape': '#9467bd',
  'baai/bay': '#8c564b',
  'meer/lake': '#e377c2',
  'regio/region': '#7f7f7f',
  'zee/sea': '#17becf',
  'fort/fortification': '#aec7e8',
  'weg/road': '#ffbb78',
  'bron/spring, well': '#98df8a',
  'klooster/monastery': '#ff9896',
  'ruïne/ruin': '#c5b0d5',
  unknown: '#bcbd22',
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
  const markersRef = useRef<Record<string, L.Marker>>({});
  const [activeCategoryStyles, setActiveCategoryStyles] = useState<
    Record<string, { color: string }>
  >({});

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
    mapInstance.current = L.map(mapContainer.current, {
      center: [20, 0],
      zoom: 2,
      attributionControl: false,
    });
    L.control
      .attribution({
        prefix: '<a href="https://leafletjs.com">Leaflet</a>',
        position: 'bottomleft',
      })
      .addTo(mapInstance.current);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(mapInstance.current);
    // @ts-ignore
    markerClusterGroup.current = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 60,
    });
    mapInstance.current.addLayer(markerClusterGroup.current);
    setIsMapInitialized(true);
    return () => {
      if (legendControl.current && mapInstance.current)
        mapInstance.current.removeControl(legendControl.current);
      mapInstance.current?.remove();
      mapInstance.current = null;
      markerClusterGroup.current = null;
      setIsMapInitialized(false);
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

  return <div ref={mapContainer} className="w-full h-full" />;
};

export default MapDisplay;
