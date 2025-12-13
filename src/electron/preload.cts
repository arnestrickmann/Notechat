const { contextBridge, ipcRenderer } = require("electron");

// Define Ollama status type
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

interface ProgressEvent {
  type: 'start' | 'progress' | 'note' | 'chunk' | 'complete' | 'error';
  totalNotes?: number;
  processedNotes?: number;
  totalChunks?: number;
  processedChunks?: number;
  currentNoteTitle?: string;
  currentChunkIndex?: number;
  message?: string;
  error?: string;
}

interface ElectronAPI {
  checkOllamaStatus: () => Promise<OllamaStatus>;
  startOllama: () => Promise<boolean>;
  setupOllama: () => Promise<boolean>;
  checkOllamaModel: (modelName: string) => Promise<boolean>;
  pullOllamaModel: (modelName: string) => Promise<boolean>;
  onSetupMessage: (callback: (message: string) => void) => () => void;
  onExtractionProgress: (callback: (event: ProgressEvent) => void) => () => void;
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

// Declare the electron property on the Window interface
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("electron", {
  checkOllamaStatus: () => ipcRenderer.invoke("checkOllamaStatus"),
  startOllama: () => ipcRenderer.invoke("startOllama"),
  setupOllama: () => ipcRenderer.invoke("setupOllama"),
  checkOllamaModel: (modelName: string) =>
    ipcRenderer.invoke("checkOllamaModel", modelName),
  pullOllamaModel: (modelName: string) =>
    ipcRenderer.invoke("pullOllamaModel", modelName),
  onSetupMessage: (callback: (message: string) => void) => {
    ipcRenderer.on("setup-message", (_: unknown, message: string) =>
      callback(message),
    );
    return () => ipcRenderer.removeAllListeners("setup-message");
  },
  onExtractionProgress: (callback: (event: ProgressEvent) => void) => {
    ipcRenderer.on("extraction-progress", (_: unknown, event: ProgressEvent) =>
      callback(event),
    );
    return () => ipcRenderer.removeAllListeners("extraction-progress");
  },
  findSimilarChunks: (
    queryText: string,
    limit?: number,
    distanceThreshold?: number,
    folderName?: string,
  ) =>
    ipcRenderer.invoke(
      "find-similar-chunks",
      queryText,
      limit,
      distanceThreshold,
      folderName,
    ),
  countNotes: () => ipcRenderer.invoke("countNotes"),
  extractAndEmbedNotes: () => ipcRenderer.invoke("extractAndEmbedNotes"),
  getNotesInDb: () => ipcRenderer.invoke("getNotesInDb"),
  getFoldersInDb: () => ipcRenderer.invoke("getFoldersInDb"),
} as ElectronAPI);
