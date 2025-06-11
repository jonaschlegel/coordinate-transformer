import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Historical Atlas Coordinate Explorer',
  description:
    'A professional cartographic tool for visualizing and analyzing historical geographic coordinates from the Grote Atlas collection. Explore settlements, waterways, mountains, and other geographic features with interactive mapping and data analysis capabilities.',
  keywords:
    'cartography, historical maps, geographic coordinates, atlas, GIS, historical geography, spatial analysis',
  authors: [{ name: 'Jona Schlegel' }],
  creator: 'Jona Schlegel',
  openGraph: {
    title: 'Historical Atlas Coordinate Explorer',
    description:
      'Professional cartographic tool for historical geographic data visualization',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
