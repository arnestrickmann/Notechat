declare interface Window {
  electron: ElectronAPI;
}

interface OllamaStatus {
  running: boolean;
  error?: string;
}

interface SimilarChunk {
  chunkId: string;
  noteTitle: string;
  noteUpdated: string;
  chunkContent: string;
  distance: number;
}

// Define the shape of Electron API
interface ElectronAPI {
  checkOllamaStatus: () => Promise<OllamaStatus>;
  startOllama: () => Promise<boolean>;
  setupOllama: () => Promise<boolean>;
  checkOllamaModel: (modelName: string) => Promise<boolean>;
  pullOllamaModel: (modelName: string) => Promise<boolean>;
  onSetupMessage: (callback: (message: string) => void) => () => void;
  findSimilarChunks: (
    queryText: string,
    limit?: number,
    distanceThreshold?: number,
    folderName?: string,
  ) => Promise<SimilarChunk[]>;
  countNotes: () => number;
  extractAndEmbedNotes: () => Promise<void>;
  getNotesInDb: () => Promise<number>;
  getFoldersInDb: () => Promise<string[]>;
}
