"use server"

import Papa from "papaparse"

interface ProcessedPoint {
  id: string
  latitude: number
  longitude: number
  originalName: string
  category: string // This should be textual, e.g., "rivier/river"
  originalCoords: string
  rowData: Record<string, string>
}

let pointIdCounter = 0

function dmsToDecimal(dmsStr: string): number {
  const parts = dmsStr.split("-").map((s) => Number.parseFloat(s.trim()))
  if (parts.some(isNaN)) {
    return Number.NaN
  }
  let decimalDegrees = 0
  if (parts.length >= 1) decimalDegrees += parts[0]
  if (parts.length >= 2) decimalDegrees += parts[1] / 60
  if (parts.length >= 3) decimalDegrees += parts[2] / 3600
  return decimalDegrees
}

function parseSingleCoordinateEntry(coordPairStr: string): { latitude: number; longitude: number } | null {
  if (
    !coordPairStr ||
    typeof coordPairStr !== "string" ||
    coordPairStr.trim() === "" ||
    coordPairStr === "-" ||
    coordPairStr === "??"
  ) {
    return null
  }
  const [latStrFull, lonStrFull] = coordPairStr.split("/")
  if (!latStrFull || !lonStrFull) return null
  let latVal: number
  let lonVal: number
  const latMatch = latStrFull.trim().match(/^([\d.-]+)([NS])$/i)
  if (!latMatch) return null
  const [, latNums, latDir] = latMatch
  latVal = dmsToDecimal(latNums)
  if (latDir.toUpperCase() === "S") latVal = -latVal
  const lonMatch = lonStrFull.trim().match(/^([\d.-]+)([EW])$/i)
  if (!lonMatch) return null
  const [, lonNums, lonDir] = lonMatch
  lonVal = dmsToDecimal(lonNums)
  if (lonDir.toUpperCase() === "W") lonVal = -lonVal
  if (isNaN(latVal) || isNaN(lonVal)) return null
  if (latVal < -90 || latVal > 90 || lonVal < -180 || lonVal > 180) return null
  return { latitude: latVal, longitude: lonVal }
}

export async function processUploadedCsv(csvText: string): Promise<{ points: ProcessedPoint[]; error?: string }> {
  pointIdCounter = 0
  try {
    const parsedCsv = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    })

    if (parsedCsv.errors.length > 0) {
      console.warn("CSV parsing errors:", parsedCsv.errors.slice(0, 5))
    }

    const data = parsedCsv.data as Array<Record<string, string>>
    if (data.length === 0 || !data[0]) {
      return { points: [], error: "CSV is empty or has no data rows." }
    }

    const points: ProcessedPoint[] = []
    const firstRowKeys = Object.keys(data[0])

    // More specific key finding
    const coordHeaderKey = firstRowKeys.find(
      (k) => k.toLowerCase().includes("coördinaten") || k.toLowerCase().includes("coordinates"),
    )
    const nameHeaderKey = firstRowKeys.find(
      (k) =>
        k.toLowerCase().includes("oorspr. naam op de kaart") || k.toLowerCase().includes("original name on the map"),
    )

    // --- REVISED CATEGORY KEY FINDING ---
    let categoryHeaderKey = firstRowKeys.find(
      (k) =>
        k.toLowerCase() === "soortnaam/category" || // Exact match first (if your header is exactly this)
        k.toLowerCase() === "soortnaam" ||
        k.toLowerCase() === "category",
    )

    // If not found by exact match, try includes, but be more careful
    if (!categoryHeaderKey) {
      categoryHeaderKey = firstRowKeys.find(
        (k) =>
          (k.toLowerCase().includes("soortnaam") || k.toLowerCase().includes("category")) &&
          // Add a check to ensure it's not likely a purely numeric column like "Index page"
          // This checks if the first data row for this key contains non-numeric characters
          data[0][k] &&
          isNaN(Number(data[0][k])),
      )
    }
    // --- END REVISED CATEGORY KEY FINDING ---

    if (!coordHeaderKey) {
      return { points: [], error: "Required 'Coordinates' column not found. Please check CSV format." }
    }
    if (!nameHeaderKey) console.warn("Optional 'Original Name' column not found. This is used for map popups.")
    if (!categoryHeaderKey) {
      console.warn(
        "Could not reliably identify the 'Soortnaam/Category' column. Markers will use a default category. Detected headers:",
        firstRowKeys.join(", "),
      )
    }

    for (const row of data) {
      const coordString = row[coordHeaderKey]
      const originalName = nameHeaderKey ? row[nameHeaderKey] || "N/A" : "N/A"

      // Use the identified categoryHeaderKey. If still not found, default to "Unknown".
      const category = categoryHeaderKey && row[categoryHeaderKey] ? row[categoryHeaderKey].trim() : "Unknown"

      if (!coordString || coordString.trim() === "" || coordString === "-" || coordString === "??") {
        continue
      }
      const coordParts = coordString.split("+").map((s) => s.trim())
      for (const part of coordParts) {
        if (part === "" || part === "-" || part === "??") continue
        const parsedLocation = parseSingleCoordinateEntry(part)
        if (parsedLocation) {
          points.push({
            id: `point-${pointIdCounter++}`,
            latitude: parsedLocation.latitude,
            longitude: parsedLocation.longitude,
            originalName,
            category: category || "Unknown", // Ensure category is never undefined
            originalCoords: part,
            rowData: row,
          })
        }
      }
    }
    return { points }
  } catch (error) {
    console.error("Error in processUploadedCsv:", error)
    return { points: [], error: error instanceof Error ? error.message : String(error) }
  }
}
