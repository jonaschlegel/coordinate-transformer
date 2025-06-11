'use client';

import { useState, useEffect } from 'react';

export default function DebugPage() {
  const [status, setStatus] = useState('Starting...');
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function debugDataLoading() {
      try {
        setStatus('Testing environment...');
        console.log('NODE_ENV:', process.env.NODE_ENV);
        console.log(
          'NEXT_PUBLIC_BASE_PATH:',
          process.env.NEXT_PUBLIC_BASE_PATH,
        );

        // Use runtime check instead of process.env.NODE_ENV for static export
        const isDevelopment =
          typeof window !== 'undefined' &&
          window.location.hostname === 'localhost';
        const assetBase = isDevelopment ? '' : '/coordinate-transformer';
        const dataUrl = `${assetBase}/points.json`;

        setStatus(`Loading from: ${dataUrl}`);
        console.log('Loading data from:', dataUrl);

        const response = await fetch(dataUrl);
        console.log('Response:', response);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        setStatus('Parsing JSON...');
        const data = await response.json();
        console.log('Raw data loaded:', data.length, 'records');

        if (data.length > 0) {
          console.log('Sample record:', data[0]);
          console.log('Headers:', Object.keys(data[0]));
        }

        setStatus('Processing coordinates...');

        // Test coordinate processing on a few records
        const recordsWithCoords = data.filter(
          (item: any) =>
            item['Coördinaten/Coordinates'] &&
            item['Coördinaten/Coordinates'] !== '-' &&
            item['Coördinaten/Coordinates'] !== '??',
        );

        console.log('Records with coordinates:', recordsWithCoords.length);

        setResults({
          totalRecords: data.length,
          recordsWithCoords: recordsWithCoords.length,
          sampleRecord: data[0],
          headers: Object.keys(data[0] || {}),
          sampleCoordRecord: recordsWithCoords[0],
        });

        setStatus('✅ Success!');
      } catch (err) {
        console.error('Debug error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('❌ Error occurred');
      }
    }

    debugDataLoading();
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Data Loading Debug</h1>

      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
        <strong>Status:</strong> {status}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {results && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <h3 className="font-bold text-green-800 mb-2">Results</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <strong>Total records:</strong> {results.totalRecords}
              </li>
              <li>
                <strong>Records with coordinates:</strong>{' '}
                {results.recordsWithCoords}
              </li>
              <li>
                <strong>Headers:</strong> {results.headers.join(', ')}
              </li>
            </ul>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded">
            <h4 className="font-bold mb-2">Sample Record</h4>
            <pre className="text-xs overflow-x-auto bg-white p-2 border rounded">
              {JSON.stringify(results.sampleRecord, null, 2)}
            </pre>
          </div>

          {results.sampleCoordRecord && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded">
              <h4 className="font-bold mb-2">Sample Record with Coordinates</h4>
              <pre className="text-xs overflow-x-auto bg-white p-2 border rounded">
                {JSON.stringify(results.sampleCoordRecord, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
