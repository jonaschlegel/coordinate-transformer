import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CSV converter',
  description:
    'Based on a comma separated values (CSV) file, this tool can extract coordinates and display them on a map.',
  generator: 'Jona Schlegel',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
