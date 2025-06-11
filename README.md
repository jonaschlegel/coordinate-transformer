# Coordinate Mapper

This web application displays points from a CSV file on an interactive map. The data is processed at build time and made available as a static site, suitable for deployment on GitHub Pages.

## Features

- Loads and parses a CSV file of coordinates at build time
- Displays locations on an interactive map
- Filter and search by category or keyword
- No server required; works as a static site

## Usage

- The main data source is `grote-atlas-I-index.csv` in the project root.
- On each build, the CSV is converted to `public/points.json`.
- The app loads this JSON file and displays the data.

## Development

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Convert the CSV to JSON:

   ```sh
   pnpm run csv-to-json
   ```

3. Start the development server:

   ```sh
   pnpm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Static Export & Deployment

- The app is configured for static export (`output: 'export'` in `next.config.mjs`).
- On every push to `main`, a GitHub Actions workflow builds and deploys the site to GitHub Pages.
- The published site is served from the `gh-pages` branch.

## Deploying to GitHub Pages

1. Push your changes to the `main` branch on GitHub.
2. In your repository settings, set GitHub Pages to deploy from the `gh-pages` branch.
3. Your site will be available at `https://jonaschlegel.github.io/coordinate-transformer/`.

---

For any changes to the data, update `grote-atlas-I-index.csv` and push to `main`. The site will update automatically.
