import path from "path";
import { app } from "electron";
import { isDev } from "./util.js";

export function getPreloadPath() {
  return path.join(
    app.getAppPath(),
    isDev() ? "." : "..",
    "/dist-electron/preload.cjs",
  );
}

export function resolveResourcePath(resourceName: string) {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, resourceName);
}

export function getDatabasePath(): string {
  if (isDev()) {
    const devDbPath = path.join(app.getAppPath(), "data", "NoteChat.db");
    return devDbPath;
  }
  // In production mode, return the path based on the user data directory
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "data", "NoteChat.db");
}
