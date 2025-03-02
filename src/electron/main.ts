import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { isDev } from "./util.js";
import { getPreloadPath } from "./pathResolver.js";
import {
  setupOllama,
  checkOllamaRunning,
  startOllama,
  checkOllamaModel,
  pullOllamaModel,
  stopOllama,
} from "./ollamaSetup.js";
import {
  extractAndEmbedNotes,
  countNotes,
} from "./noteProcessing/extractAndEmbedNotes.js";
import { DatabaseService } from "./database/databaseService.js";

export let mainWindow: BrowserWindow | null = null;
let dbService: DatabaseService;

async function createWindow() {
  try {
    mainWindow = new BrowserWindow({
      webPreferences: {
        preload: getPreloadPath(),
        sandbox: false, 
        nodeIntegration: true,
        contextIsolation: true,
      },
      titleBarStyle: "hidden",
      frame: false,
      backgroundColor: "#F2F2F7",
      useContentSize: true,
      thickFrame: false,
    });

    if (isDev()) {
      mainWindow.loadURL("http://localhost:5123");
    } else {
      mainWindow.loadFile(
        path.join(app.getAppPath(), "/dist-react/index.html"),
      );
    }

    mainWindow.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription) => {
        console.error("Failed to load:", errorCode, errorDescription);
      },
    );

    // Initialize database service
    dbService = new DatabaseService();

    // Database IPC handlers
    ipcMain.handle(
      "find-similar-chunks",
      async (
        event,
        queryText: string,
        limit?: number,
        distanceThreshold?: number,
        folderName?: string,
      ) => {
        try {
          const similarChunks = await dbService.findSimilarChunks(
            queryText,
            limit,
            distanceThreshold,
            folderName,
          );
          return similarChunks;
        } catch (error) {
          console.error("Error handling find-similar-chunks:", error);
          throw new Error("Failed to find similar chunks");
        }
      },
    );

    ipcMain.handle("getNotesInDb", async () => {
      const dbService = DatabaseService.getInstance();
      return dbService.getNotesInDb();
    });

    ipcMain.handle("getFoldersInDb", async () => {
      try {
        const dbService = DatabaseService.getInstance();
        return dbService.getFoldersInDb();
      } catch (error) {
        console.error("Error handling getFoldersInDb:", error);
        throw new Error("Failed to get folders from database");
      }
    });

    // Note extraction related IPC handlers
    ipcMain.handle("countNotes", async () => {
      try {
        const totalNotes = countNotes();
        return totalNotes;
      } catch (error) {
        console.error("Error handling countNotes:", error);
        throw new Error("Failed to count notes");
      }
    });

    ipcMain.handle("extractAndEmbedNotes", async () => {
      try {
        await extractAndEmbedNotes(dbService);
        return { success: true };
      } catch (error) {
        console.error("Error handling extractAndEmbedNotes:", error);
        throw new Error("Failed to extract and embed notes");
      }
    });

    // Ollama-related IPC handlers
    ipcMain.handle("setupOllama", async () => {
      try {
        mainWindow?.webContents.send("setup-message", "Setting up Notechat...");
        const result = await setupOllama();
        if (result) {
          mainWindow?.webContents.send(
            "setup-message",
            "Notechat setup completed successfully!",
          );
        }
        return result;
      } catch (error) {
        console.error("Failed to setup Notechat:", error);
        mainWindow?.webContents.send(
          "setup-message",
          "Failed to setup Notechat",
        );
        return false;
      }
    });

    ipcMain.handle("checkOllamaStatus", async () => {
      try {
        const isRunning = await checkOllamaRunning();
        return { running: isRunning };
      } catch (error) {
        return { running: false, error: error };
      }
    });

    ipcMain.handle("startOllama", async () => {
      try {
        mainWindow?.webContents.send(
          "setup-message",
          "Starting Ollama server...",
        );
        const result = await startOllama();
        if (result) {
          mainWindow?.webContents.send(
            "setup-message",
            "Ollama server started successfully!",
          );
        }
        return result;
      } catch (error) {
        mainWindow?.webContents.send(
          "setup-message",
          "Failed to start Ollama server",
        );
        return false;
      }
    });

    ipcMain.handle("checkOllamaModel", async (_, modelName: string) => {
      try {
        return await checkOllamaModel(modelName);
      } catch (error) {
        console.error(`Failed to check ${modelName} model:`, error);
        return false;
      }
    });

    ipcMain.handle("pullOllamaModel", async (_, modelName: string) => {
      try {
        return await pullOllamaModel(modelName);
      } catch (error) {
        console.error(`Failed to pull ${modelName}:`, error);
        return false;
      }
    });

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  } catch (error) {
    console.error("Failed to create window:", error);
    throw error;
  }
}

async function initializeApp() {
  try {
    await stopOllama();
    await createWindow();
    console.log("Window created successfully");
  } catch (error) {
    console.error("Failed to initialize application:", error);
    app.quit();
  }
}

// App event handlers
app.on("ready", () => {
  console.log("App ready event fired");
  console.log("Electron version:", process.versions.electron);
  console.log("Chrome version:", process.versions.chrome);
  console.log("Node version:", process.versions.node);

  initializeApp().catch((error) => {
    console.error("Failed to initialize app:", error);
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }
    app.quit();
  });
});

app.on("window-all-closed", async () => {
  if (dbService) {
    await dbService.close();
  }
  await stopOllama();
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) {
    initializeApp().catch((error) => {
      console.error("Failed to initialize app on activate:", error);
      app.quit();
    });
  }
});

// Handle any unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Handle cleanup on app quit
app.on("before-quit", async (event) => {
  if (dbService) {
    event.preventDefault();
    try {
      await dbService.close();
      app.quit();
    } catch (error) {
      console.error("Error closing database:", error);
      app.quit();
    }
  }
});
