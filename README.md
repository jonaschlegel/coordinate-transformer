# Historical Atlas Explorer

An interactive web application for exploring and visualizing geographic data from historical atlases. This project processes coordinate data from the "Grote Atlas" index and provides tools for searching, filtering, and mapping historical locations.

## 🌟 Features

- **Interactive Map Display**: View historical locations on an interactive map with clustering
- **Advanced Search & Filtering**: Search by name, category, coordinates, or any field
- **Data Processing**: Automatic coordinate parsing from historical DMS format
- **Export Functionality**: Export filtered data as CSV
- **Performance Optimized**: Web Worker support for large datasets
- **Responsive Design**: Works on desktop and mobile devices

## 🚀 Live Demo

Visit the live application: [https://jonaschlegel.github.io/coordinate-transformer/](https://jonaschlegel.github.io/coordinate-transformer/)

## 📊 Data Statistics

- **Total Records**: 11,084 entries from the historical atlas
- **Geographic Data**: 7,575 records with coordinates (68.3%)
- **Parsing Success**: 99.5% coordinate parsing accuracy
- **Categories**: 10+ location types (settlements, islands, capes, rivers, etc.)

## 🛠️ Development

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
git clone https://github.com/jonaschlegel/coordinate-transformer.git
cd coordinate-transformer
npm install
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Data Processing

To regenerate the data from the CSV:

```bash
npm run csv-to-json
```

To analyze the data:

```bash
node scripts/analyze-data.mjs
```

### Building for Production

```bash
npm run build
```

### Deployment

The project is configured for GitHub Pages:

```bash
npm run deploy
```

## 🏗️ Architecture

- **Frontend**: Next.js 15 with React 18
- **Styling**: Tailwind CSS with custom components
- **Data Processing**: Web Workers for non-blocking coordinate parsing
- **Mapping**: Leaflet.js with marker clustering
- **Performance**: Virtual scrolling for large data tables

## 📁 Project Structure

```
├── app/                    # Next.js app directory
├── components/            # React components
├── lib/                   # Utility functions and data processing
├── public/                # Static assets and data files
├── scripts/               # Data processing scripts
└── styles/                # Global styles
```

## 🔧 Data Format

The application processes CSV data with the following structure:

- **Original Names**: Historical place names from the atlas
- **Present Names**: Modern equivalent names
- **Categories**: Location types (settlements, islands, rivers, etc.)
- **Coordinates**: Historical DMS format (e.g., "12-30N/92-50E")
- **Map References**: Grid squares and page numbers

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Historical atlas data from the "Grote Atlas" index
- Built with modern web technologies for optimal performance
- Designed for researchers, historians, and geography enthusiasts
