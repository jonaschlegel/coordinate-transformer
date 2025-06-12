# Grote Atlas Point Explorer

A web app for exploring and visualizing geographic data from the grote atlas based on a spreadsheet (CSV comma separated). This project processes coordinate data (in the degree, minutes, seconds to WGS84 decimal format) from the "Grote Atlas" index and provides features for searching, filtering, and mapping these data points in a table as well as map view.

## Features

- **Map Display**: View points on an openstreet map with clustering and categoriesed based on place types
- **Search & Filtering**: Search by name, category, coordinates, or any field
- **Data Processing**: Automatic coordinate convertion (degree, minutes, seconds to WGS84 decimal format)
- **Export Functionality**: Export filtered data as CSV, with the new converted coordinates

## Live Demo

Visit the live application: [https://jonaschlegel.github.io/coordinate-transformer/](https://jonaschlegel.github.io/coordinate-transformer/)

## Data Statistics

- **Total Records**: 11,084 entries from the "Grote Atlas"
- **Geographic Data**: 7,575 records with coordinates (68.3%)
- **Parsing Success**: 99.5% coordinate parsing accuracy
- **Categories**: 10+ location types (settlements, islands, capes, rivers, etc.)

## Development

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
git clone https://github.com/jonaschlegel/coordinate-transformer.git
cd coordinate-transformer
pnpm install
```

### Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Data Processing

To regenerate the data from the CSV:

```bash
pnpm run csv-to-json
```

### Building for Production

```bash
pnpm build
```

### Deployment

The project is configured for GitHub Pages.
