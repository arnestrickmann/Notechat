<h1>
  <img src="https://notechat.app/logo.png" alt="NoteChat Logo" width="50" align="center"/>
  Notechat
</h1>

<img src="https://www.notechat.app/ollamaapplenotes.png" alt="NoteChat Demo" width="100%">

Notechat is a desktop application that enables you to interact with your Apple Notes through a chat interface.
Built with Electron and React, it provides a seamless experience for conversing with your notes.

<p align="start">
  <a href="https://youtu.be/YeAgi0HQo7M?si=ivRz7Pp1xvq8HHBC">
    <img src="https://www.notechat.app/screenshotmusic.png" alt="NoteChat Demo" width="100%">
  </a>
</p>

## Download NoteChat with Cloud Mode

👉 [Download NoteChat Cloud Mode](https://notechat.app)


## Builders

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/matsjfunke">
        <img src="https://github.com/matsjfunke.png" width="100px;" alt="Mats Funke"/>
        <br />
        <sub><b>Mats Funke</b></sub>
      </a>
      <br />
      <a href="https://github.com/matsjfunke">
        <img src="https://img.shields.io/badge/github-%23121011.svg?style=for-the-badge&logo=github&logoColor=white" alt="GitHub" width="100px"/>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/arnestrickmann">
        <img src="https://github.com/arnestrickmann.png" width="100px;" alt="Arne Strickmann"/>
        <br />
        <sub><b>Arne Strickmann</b></sub>
      </a>
      <br />
      <a href="https://github.com/arnestrickmann">
        <img src="https://img.shields.io/badge/github-%23121011.svg?style=for-the-badge&logo=github&logoColor=white" alt="GitHub" width="100px"/>
      </a>
    </td>
  </tr>
</table>


## Contributing to Notechat

We welcome contributions from the community! Feel free to open a Pull Request. 

## Project Structure

**Vite** is used as the development server and build tool for the **React** (src/ui) part of the application.
**Electron** handles the desktop application wrapper and native system interactions (src/electron).

```sh
.
├── README.md
├── data/                    # dir for dev database file
├── dist/                    # Compiled Electron files
├── dist-electron/           # Compiled Electron files
├── dist-react/              # Built React application
├── electron-builder.json    # Electron build configuration
├── index.html
├── package-lock.json
├── package.json             # Project metadata and dependencies
├── src
│   ├── electron/            # Electron main process code
│   │   ├── main.ts          # Main electron process
│   │   ├── database
│   │   │   └── databaseService.ts # Initializes schema, handles CRUD with better-sqlite3
│   │   ├── noteProcessing
│   │   │   ├── CharChunker.ts # chunks note body by into max chunks, prefixes note title to chunk
│   │   │   └── extractAndEmbedNotes.ts # extracts, chunks, embedds and saves notes
│   │   ├── tsconfig.json    # TypeScript config for electron
│   │   ├── ollamaSetup.ts
│   │   ├── pathResolver.ts
│   │   ├── preload.cts
│   │   └── util.ts
│   ├── types
│   │   └── electron.d.ts    # types from electron used in frontend
│   └── ui/                  # React frontend code
│       ├── App.tsx          # Main React component
│       ├── assets/          # Static assets
│       ├── App.css
│       ├── index.css
│       ├── main.tsx
│       ├── constants/
│       └── components/     # reusable components
├── vite.config.ts          # Vite bundler configuration
└── tsconfig.json           # TypeScript config for react
```

## Getting Started

```sh
# Install dependencies
npm install

# Start development environment React and Electron in development mode (hot reloading)
npm run dev

# Compiles TypeScript and builds the application
npm run build

# For a clean build macOS distribution (ARM64)
npm run clean && npm run dist:mac
```

**Running packaged App from Terminal** 

run the app from `/dist`
```sh
# Mount (open) a DMG file
hdiutil attach dist/NoteChat-0.0.0-arm64.dmg
# Navigate to the Mounted Volume
cd /Volumes/NoteChat\ 0.0.0-arm64
# Run the Application
./NoteChat.app/Contents/MacOS/NoteChat
```

run the app from `Applications` folder
```sh
# run the application from terminal (to view logs)
/Applications/NoteChat.app/Contents/MacOS/NoteChat

# find location of app
mdfind "kMDItemDisplayName == 'NoteChat'"
```

## Inter-Process Communication (IPC)

- In the `preload.cts`, everything attached via `contextBridge` is added to the `window` object under the keyword `electron`.

  ```javascript
  electron.contextBridge.exposeInMainWorld("electron", {
    getStaticData: () => console.log("static"),
    // other methods
  });
  ```

  In the browser's console within the app, you can execute `window.electron.getStaticData()`, and it will log "static".

Here's the updated documentation with real examples from your chat application:

## Inter-Process Communication (IPC)

**Electron's IPC system** enables secure communication between the main process (Node.js) and renderer process (browser).
The `preload.cts` script acts as a bridge, exposing only specific functions and data to the renderer process through the contextBridge.

Basic Structure:

1. Preload Script (preload.cts): Defines what the renderer can access
2. Main Process (main.ts): Handles the actual functionality
3. Renderer Process: Uses the exposed functions in React components

### Setup

In `main.ts`, we ensure the `preload.cts` is run before opening the window:

```typescript
const mainWindow = new BrowserWindow({
  webPreferences: {
    preload: getPreloadPath(),
  },
});
```

### IPC Implementation

#### 1. Preload Script (`preload.cts`)

The `preload.cts` script defines the API that will be available to the renderer process. We use TypeScript interfaces to ensure type safety:

```typescript
const { contextBridge, ipcRenderer } = require("electron");

// Define the API types
interface ElectronAPI {
  checkOllamaStatus: () => Promise<{ running: boolean; error?: string }>;
  startOllama: () => Promise<boolean>;
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("electron", {
  checkOllamaStatus: () => ipcRenderer.invoke("checkOllamaStatus"),
  startOllama: () => ipcRenderer.invoke("startOllama"),
} as ElectronAPI);
```

#### 2. Main Process (`main.ts`)

In the `main.ts` process, we handle the IPC calls defined in the preload script. Each handler performs its specific task and returns the result:

```typescript
app.on("ready", () => {
  // Handle Ollama status checks
  ipcMain.handle("checkOllamaStatus", async () => {
    try {
      const isRunning = await checkOllamaRunning();
      return { running: isRunning };
    } catch (error) {
      return { running: false, error: error.message };
    }
  });
});
```

#### 3. Renderer Process (React Component)

In your React components, you can now safely call these methods through the `window.electron` object:

```typescript
function Chat() {
  useEffect(() => {
    const checkStatus = async () => {
      const status = await window.electron.checkOllamaStatus();
      setOllamaStatus(status);
    };
    checkStatus();
  }, []);

  const handleStartOllama = async () => {
    const success = await window.electron.startOllama();
    if (success) {
      // Handle successful start
    }
  };
}
```

### Type Safety

Define the window interface in `electron.d.ts` to ensure TypeScript recognizes the electron API:

```typescript
declare global {
  interface Window {
    electron: {
      checkOllamaStatus: () => Promise<{ running: boolean; error?: string }>;
      startOllama: () => Promise<boolean>;
    };
  }
}
```

### Testing in Console

You can test these IPC methods directly in the browser's DevTools console:

```javascript
// Check Ollama status
await window.electron.checkOllamaStatus();
// Returns: { running: true }

// Start Ollama
await window.electron.startOllama();
// Returns: true
```

This implementation provides a secure and type-safe way to communicate between processes in your Electron application.
The preload script acts as a security boundary, exposing only the necessary functionality to the renderer process while maintaining the isolation between Node.js and browser contexts.

## Database setup

The `databaseService.ts` file defines a DatabaseService class that manages interactions with a SQLite database using the `better-sqlite3` library. It is designed as a singleton, ensuring only one instance of the database connection is active at any time. This service handles the initialization of the database schema, ensuring necessary tables exist, and provides methods for saving notes and chunks of data. It also supports vector operations using `sqlite-vec` for tasks like finding similar data entries based on vector similarity.

need to load sqlite-vec extension like this:
```typescript
    const extensionPath = path.join(
      app.getAppPath().replace('app.asar', 'app.asar.unpacked'),
      'node_modules/sqlite-vec-darwin-arm64/vec0.dylib'
    );
    this.vectorDb.loadExtension(extensionPath);
```
because node api uses meta.url() to detect path which doesn’t work for packaged electron version since it detects `app.asar` as folder but its actually in `app.asar.unpacked`, the above fixes: `
```sh
SqliteError: dlopen(/Users/matsfunke/dev/AppName/AppName.app/Contents/Resources/app.asar/node_modules/sqlite-vec-darwin-arm64/vec0.dylib.dylib, 0x000A): tried: '/Users/matsfunke/dev/AppName/AppName.app/Contents/Resources/app.asar/node_modules/sqlite-vec-darwin-arm64/vec0.dylib.dylib' (errno=20)
```

## Resolving Module Version Mismatch Error

If you encounter the following error:

```sh
Failed to initialize application: Error: The module '.../better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 115.
This version of Node.js requires NODE_MODULE_VERSION 123.
```

Follow these steps to resolve it:

```sh
# Remove existing node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
npm install

# Rebuild native modules for Electron
npx electron-rebuild

# Start the application
npm run dev
```
