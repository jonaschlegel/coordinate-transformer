"use client"

import type React from "react"
import { useRef, useEffect, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet.markercluster/dist/MarkerCluster.css"
import "leaflet.markercluster/dist/MarkerCluster.Default.css"
import "leaflet.markercluster"

interface PointData {
  id: string
  latitude: number
  longitude: number
  originalName: string
  originalCoords: string
  category: string
}

interface MapDisplayProps {
  points: PointData[]
  selectedPointId: string | null
  onPointSelect: (pointId: string | null) => void
}

// Predefined preferred colors
const PREDEFINED_CATEGORY_COLORS: Record<string, string> = {
  "plaats/settlement": "#1f77b4", // Blue
  "rivier/river": "#2ca02c", // Green
  "berg/mountain": "#d62728", // Red
  "eiland/island": "#ff7f0e", // Orange
  "kaap/cape": "#9467bd", // Purple
  "baai/bay": "#8c564b", // Brown
  "meer/lake": "#e377c2", // Pink
  "regio/region": "#7f7f7f", // Gray
  "zee/sea": "#17becf", // Cyan
  "fort/fortification": "#aec7e8", // Light Blue
  "weg/road": "#ffbb78", // Light Orange
  "bron/spring, well": "#98df8a", // Light Green
  "klooster/monastery": "#ff9896", // Light Red
  "ruïne/ruin": "#c5b0d5", // Light Purple
  unknown: "#bcbd22", // Yellow-Green for Unknown
}
const DEFAULT_FALLBACK_COLOR = "#333333" // Dark gray for truly unknown cases after generation

// Helper to create category icons
const createCategoryIcon = (color: string, isSelected?: boolean) => {
  const borderStyle = isSelected ? "3px solid #0ea5e9" : "1px solid white"
  const size = isSelected ? "16px" : "12px"
  const shadow = isSelected ? "0 0 8px rgba(14, 165, 233, 0.7)" : "0 0 2px rgba(0,0,0,0.5)"
  return L.divIcon({
    html: `<span style="background-color: ${color}; width: ${size}; height: ${size}; border-radius: 50%; display: inline-block; border: ${borderStyle}; box-shadow: ${shadow}; transition: all 0.2s ease-in-out;"></span>`,
    className: `custom-div-icon ${isSelected ? "selected-marker-icon" : ""}`,
    iconSize: isSelected ? [16, 16] : [12, 12],
    iconAnchor: isSelected ? [8, 8] : [6, 6],
  })
}

if (typeof window !== "undefined") {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  })
}

const MapDisplay: React.FC<MapDisplayProps> = ({ points, selectedPointId, onPointSelect }) => {
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markerClusterGroup = useRef<L.MarkerClusterGroup | null>(null)
  const legendControl = useRef<L.Control | null>(null)
  const [isMapInitialized, setIsMapInitialized] = useState(false)
  const [isLegendOpen, setIsLegendOpen] = useState(true)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const [activeCategoryStyles, setActiveCategoryStyles] = useState<Record<string, { color: string }>>({})

  // Effect to generate and set category styles (colors)
  useEffect(() => {
    if (!points || points.length === 0) {
      setActiveCategoryStyles({})
      return
    }

    const uniqueCategories = Array.from(new Set(points.map((p) => p.category))).sort()
    const newStyles: Record<string, { color: string }> = {}
    const usedColors = new Set<string>()

    // Pass 1: Apply predefined colors if available and unique
    uniqueCategories.forEach((category) => {
      const normalizedCategoryKey = category.toLowerCase()
      const predefinedColor = PREDEFINED_CATEGORY_COLORS[normalizedCategoryKey]
      if (predefinedColor && !usedColors.has(predefinedColor)) {
        newStyles[category] = { color: predefinedColor }
        usedColors.add(predefinedColor)
      }
    })

    // Pass 2: Generate unique dynamic colors for categories without one
    let dynamicColorIndex = 0
    uniqueCategories.forEach((category) => {
      if (!newStyles[category]) {
        // If category still doesn't have a style
        let attempts = 0
        let generatedColor
        do {
          // Generate hue, ensuring good distribution using golden angle ratio
          const hue = (dynamicColorIndex * 137.508 + attempts * 15) % 360 // Add small increment on attempts
          generatedColor = `hsl(${Math.floor(hue)}, 70%, 50%)`
          attempts++
        } while (usedColors.has(generatedColor) && attempts < 25) // Limit attempts

        if (usedColors.has(generatedColor)) {
          // Highly unlikely fallback
          generatedColor = `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`
        }

        newStyles[category] = { color: generatedColor }
        usedColors.add(generatedColor)
        dynamicColorIndex++
      }
    })
    setActiveCategoryStyles(newStyles)
  }, [points])

  // Map Initialization (runs once)
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return
    mapInstance.current = L.map(mapContainer.current, { center: [20, 0], zoom: 2, attributionControl: false })
    L.control
      .attribution({ prefix: '<a href="https://leafletjs.com">Leaflet</a>', position: "bottomleft" })
      .addTo(mapInstance.current)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(mapInstance.current)
    // @ts-ignore
    markerClusterGroup.current = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 60 })
    mapInstance.current.addLayer(markerClusterGroup.current)
    setIsMapInitialized(true)
    return () => {
      if (legendControl.current && mapInstance.current) mapInstance.current.removeControl(legendControl.current)
      mapInstance.current?.remove()
      mapInstance.current = null
      markerClusterGroup.current = null
      setIsMapInitialized(false)
    }
  }, [])

  // Legend Update: Depends on activeCategoryStyles and isLegendOpen
  useEffect(() => {
    if (!isMapInitialized || !mapInstance.current) return
    const map = mapInstance.current
    if (legendControl.current) map.removeControl(legendControl.current)

    const sortedCategories = Object.keys(activeCategoryStyles).sort()

    if (sortedCategories.length > 0) {
      const legend = new L.Control({ position: "bottomright" })
      legend.onAdd = () => {
        const div = L.DomUtil.create("div", "info legend leaflet-control-layers leaflet-control-layers-expanded")
        // Styling for legend box
        div.style.backgroundColor = "rgba(255,255,255,0.9)"
        div.style.padding = "6px 10px"
        div.style.borderRadius = "5px"
        div.style.boxShadow = "0 0 10px rgba(0,0,0,0.2)"
        div.style.maxWidth = "180px"

        const header = L.DomUtil.create("div", "", div)
        // Styling for legend header
        header.style.cursor = "pointer"
        header.style.marginBottom = isLegendOpen ? "6px" : "0"
        header.style.fontWeight = "bold"
        header.style.fontSize = "13px"
        header.style.display = "flex"
        header.style.justifyContent = "space-between"
        header.style.alignItems = "center"
        header.innerHTML = `<span>Legend</span><span style="font-size: 1.1em;">${isLegendOpen ? "&#9660;" : "&#9654;"}</span>`

        const content = L.DomUtil.create("div", "", div)
        // Styling for legend content area
        content.style.maxHeight = "120px" // Adjust as needed
        content.style.overflowY = "auto"
        content.style.display = isLegendOpen ? "block" : "none"

        L.DomEvent.disableClickPropagation(div)
        L.DomEvent.disableScrollPropagation(div)
        header.onclick = (e) => {
          e.stopPropagation()
          setIsLegendOpen(!isLegendOpen)
        }
        if (isLegendOpen) {
          let legendHtml = ""
          sortedCategories.forEach((category) => {
            const color = activeCategoryStyles[category]?.color || DEFAULT_FALLBACK_COLOR
            legendHtml += `<div style="display: flex; align-items: center; margin-bottom: 3px;"><span style="background-color: ${color}; width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 6px; border: 1px solid #ccc; flex-shrink: 0; box-shadow: 0 0 1px rgba(0,0,0,0.3);"></span><span style="font-size: 11px; word-break: break-word;">${category}</span></div>`
          })
          content.innerHTML = legendHtml
        }
        return div
      }
      legend.addTo(map)
      legendControl.current = legend
    }
  }, [activeCategoryStyles, isMapInitialized, isLegendOpen, setIsLegendOpen])

  // Markers Update & Interaction
  useEffect(() => {
    if (!isMapInitialized || !mapInstance.current || !markerClusterGroup.current) return
    const map = mapInstance.current
    const currentMarkersGroup = markerClusterGroup.current

    currentMarkersGroup.clearLayers()
    markersRef.current = {}

    const leafletMarkers: L.Marker[] = []
    points.forEach((point) => {
      const isSelected = point.id === selectedPointId
      const categoryStyle = activeCategoryStyles[point.category]
      const markerColor = categoryStyle?.color || DEFAULT_FALLBACK_COLOR
      const icon = createCategoryIcon(markerColor, isSelected)

      const marker = L.marker([point.latitude, point.longitude], { icon })
      marker.on("click", () => onPointSelect(point.id))
      marker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 13px; max-width: 250px;">
        <strong style="display: block; margin-bottom: 3px; font-size: 14px;">${point.originalName}</strong>
        <strong>Category:</strong> ${point.category}<br>
        <strong>Original:</strong> ${point.originalCoords}<br>
        <strong>Coords:</strong> ${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}
      </div>
    `)
      marker.bindTooltip(`${point.originalName} (${point.category})`)
      markersRef.current[point.id] = marker
      leafletMarkers.push(marker)
    })

    if (leafletMarkers.length > 0) {
      currentMarkersGroup.addLayers(leafletMarkers)
      if (points.length > 0 && (!map.getBounds().contains(currentMarkersGroup.getBounds()) || map.getZoom() < 3)) {
        try {
          const bounds = currentMarkersGroup.getBounds()
          if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
        } catch (e) {
          /* ignore */
        }
      }
    } else {
      map.setView([20, 0], 2)
    }
  }, [points, isMapInitialized, onPointSelect, selectedPointId, activeCategoryStyles])

  // Effect to handle map reaction to selectedPointId
  const TARGET_SELECTION_ZOOM = 16 // Define the desired zoom level

  // Effect to handle map reaction to selectedPointId
  useEffect(() => {
    if (!isMapInitialized || !mapInstance.current) return

    if (!selectedPointId) {
      mapInstance.current.closePopup()
      // Potentially reset icon styles for previously selected markers if not handled by full re-render
      // For now, the re-render of icons handles deselection styling.
      return
    }

    const marker = markersRef.current[selectedPointId]
    const map = mapInstance.current

    if (marker) {
      const targetLatLng = marker.getLatLng()

      // Ensure the icon for the newly selected marker is updated immediately
      // This is important if the icon style changes significantly on selection
      const categoryStyle =
        activeCategoryStyles[
          marker.options.title || points.find((p) => p.id === selectedPointId)?.category || "Unknown"
        ]
      const markerColor = categoryStyle?.color || DEFAULT_FALLBACK_COLOR
      marker.setIcon(createCategoryIcon(markerColor, true))

      if (markerClusterGroup.current) {
        // @ts-ignore
        markerClusterGroup.current.zoomToShowLayer(marker, () => {
          // zoomToShowLayer has completed. Now, set the final view.
          // It's possible zoomToShowLayer already centered well, but setView ensures it.
          map.setView(targetLatLng, TARGET_SELECTION_ZOOM)
          if (!marker.isPopupOpen()) {
            marker.openPopup()
          }
        })
      } else {
        // Fallback if not using marker cluster or if it's a single point
        map.setView(targetLatLng, TARGET_SELECTION_ZOOM)
        if (!marker.isPopupOpen()) {
          marker.openPopup()
        }
      }
    }

    // Reset icon for previously selected marker if it exists and is different
    // This is handled by the main marker update loop when selectedPointId changes,
    // as it re-evaluates `isSelected` for all markers.
    // However, if you want an immediate visual change without waiting for the full loop:
    Object.values(markersRef.current).forEach((m) => {
      if (m !== marker) {
        // If it's not the currently selected marker
        const pointData = points.find((p) => markersRef.current[p.id] === m)
        if (pointData) {
          const catStyle = activeCategoryStyles[pointData.category]
          const color = catStyle?.color || DEFAULT_FALLBACK_COLOR
          // @ts-ignore // Accessing custom property on marker if you stored it
          if (m.options.icon && m.options.icon.options.className.includes("selected-marker-icon")) {
            m.setIcon(createCategoryIcon(color, false))
          }
        }
      }
    })
  }, [selectedPointId, isMapInitialized, activeCategoryStyles, points])

  return <div ref={mapContainer} className="w-full h-full" />
}

export default MapDisplay
