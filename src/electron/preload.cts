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
