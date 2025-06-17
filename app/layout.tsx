import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Grote Atlas data display',
  description:
    'A webapp to load and transform csv data from the Grote Atlas. This app enables you to view the data on a map and filter and search through it.',
  keywords:
    'cartography, historical maps, geographic coordinates, atlas, GIS, historical geography, spatial analysis',
  authors: [{ name: 'Jona Schlegel' }],
  creator: 'Jona Schlegel',
  openGraph: {
    title: 'Grote Atlas data display',
    description:
      'Webapp to load, transform and visualise csv data from the Grote Atlas on an online map.',
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
