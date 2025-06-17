export interface Point {
  id: string;
  latitude: number;
  longitude: number;
  originalName: string;
  category: string;
  originalCoords: string;
  rowData: Record<string, string>;
}

export interface WorkerMessage {
  type: 'PROCESS_DATA' | 'FILTER_DATA' | 'PROGRESS' | 'COMPLETE' | 'ERROR';
  payload: any;
}

export class DataWorkerClient {
  private worker: Worker | null = null;
  private isProcessing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const assetBase = process.env.NEXT_PUBLIC_BASE_PATH || '';
      this.worker = new Worker(`${assetBase}/data-worker.js`);
    }
  }

  async processRawData(
    rawData: any[],
    onProgress?: (progress: number) => void,
  ): Promise<Point[]> {
    if (!this.worker) {
      throw new Error('Web Worker not available');
    }

    if (this.isProcessing) {
      throw new Error('Worker is already processing data');
    }

    this.isProcessing = true;

    return new Promise((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerMessage>) => {
        const { type, payload } = event.data;

        switch (type) {
          case 'PROGRESS':
            onProgress?.(payload.progress);
            break;
          case 'COMPLETE':
            this.worker!.removeEventListener('message', handleMessage);
            this.isProcessing = false;
            resolve(payload.points);
            break;
          case 'ERROR':
            this.worker!.removeEventListener('message', handleMessage);
            this.isProcessing = false;
            reject(new Error(payload.message));
            break;
        }
      };

      this.worker!.addEventListener('message', handleMessage);
      this.worker!.postMessage({
        type: 'PROCESS_DATA',
        payload: { rawData },
      });
    });
  }

  async filterData(
    points: Point[],
    categoryFilter: string,
    searchQuery: string,
    sortConfig?: { key: string; direction: 'asc' | 'desc' } | null,
  ): Promise<Point[]> {
    if (!this.worker) {
      throw new Error('Web Worker not available');
    }

    return new Promise((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerMessage>) => {
        const { type, payload } = event.data;

        switch (type) {
          case 'COMPLETE':
            this.worker!.removeEventListener('message', handleMessage);
            resolve(payload.points);
            break;
          case 'ERROR':
            this.worker!.removeEventListener('message', handleMessage);
            reject(new Error(payload.message));
            break;
        }
      };

      this.worker!.addEventListener('message', handleMessage);
      this.worker!.postMessage({
        type: 'FILTER_DATA',
        payload: { points, categoryFilter, searchQuery, sortConfig },
      });
    });
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isProcessing = false;
  }
}
