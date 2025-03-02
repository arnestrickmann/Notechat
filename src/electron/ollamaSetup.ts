import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

// common homebrew and binary paths on macos
const COMMON_PATHS = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/opt/homebrew/sbin",
  "/usr/local/sbin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
];

// Build enhanced environment with proper path
function getEnhancedEnvironment() {
  const env = { ...process.env };
  const currentPath = env.PATH || "";

  // Add common paths to PATH if they're not already there
  const newPath = [...COMMON_PATHS, currentPath].filter(Boolean).join(":");

  return {
    ...env,
    PATH: newPath,
    HOME: env.HOME || `/Users/${env.USER}`,
  };
}

// Execute command with enhanced PATH
async function execWithPath(command: string, options: any = {}) {
  const env = getEnhancedEnvironment();
  // console.log("Executing command with PATH:", env.PATH);
  return execAsync(command, { ...options, env });
}

// Find executable in common paths
async function findExecutable(name: string): Promise<string | null> {
  for (const basePath of COMMON_PATHS) {
    const execPath = path.join(basePath, name);
    try {
      await fs.access(execPath, fs.constants.X_OK);
      // console.log(`Found ${name} at: ${execPath}`);
      return execPath;
    } catch {
      continue;
    }
  }
  return null;
}

export async function checkOllamaInstallation(): Promise<boolean> {
  try {
    const ollamaPath = await findExecutable("ollama");
    if (ollamaPath) {
      console.log("✓ Ollama found at:", ollamaPath);
      return true;
    }
    console.log("✗ Ollama not found in common paths");
    return false;
  } catch (error) {
    console.log("✗ Error checking Ollama installation:", error);
    return false;
  }
}

export async function installOllama(): Promise<boolean> {
  console.log("Installing Ollama...");

  try {
    // Check for Homebrew
    console.log("Checking for Homebrew...");
    const brewPath = await findExecutable("brew");

    if (!brewPath) {
      console.log("✗ Homebrew not found. Installing Homebrew...");
      // Use full path for bash
      const bashPath = (await findExecutable("bash")) || "/bin/bash";
      await execWithPath(
        `${bashPath} -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`,
      );
      console.log("✓ Homebrew installed successfully");
    } else {
      console.log("✓ Homebrew found at:", brewPath);
    }

    // Install Ollama using the full brew path
    const finalBrewPath = (await findExecutable("brew")) || "brew";
    console.log("Installing Ollama with Homebrew at:", finalBrewPath);
    await execWithPath(`${finalBrewPath} install ollama`);
    console.log("✓ Ollama installed with Homebrew");

    return await checkOllamaInstallation();
  } catch (error) {
    console.error("Failed to install Ollama:", error);
    return false;
  }
}

export async function checkOllamaModel(modelName: string): Promise<boolean> {
  try {
    const ollamaPath = await findExecutable("ollama");
    if (!ollamaPath) return false;

    const { stdout } = await execWithPath(`${ollamaPath} list`);
    return stdout.includes(modelName);
  } catch {
    return false;
  }
}

export async function pullOllamaModel(modelName: string): Promise<boolean> {
  try {
    const ollamaPath = await findExecutable("ollama");
    if (!ollamaPath) return false;

    console.log(`Pulling ${modelName} model...`);
    await execWithPath(`${ollamaPath} pull ${modelName}`);
    console.log(`✓ ${modelName} model pulled successfully`);
    return true;
  } catch (error) {
    console.error(`Failed to pull ${modelName}:`, error);
    return false;
  }
}

export async function checkOllamaRunning(): Promise<boolean> {
  try {
    await execAsync("lsof -i :11434");
    return true;
  } catch {
    return false;
  }
}

export async function startOllama(): Promise<boolean> {
  console.log("Starting Ollama server...");
  try {
    const ollamaPath = await findExecutable("ollama");
    if (!ollamaPath) {
      throw new Error("Ollama executable not found");
    }

    // Use full path to ollama
    await execWithPath(`${ollamaPath} serve > /dev/null 2>&1 &`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log("✓ Ollama server started");
    return true;
  } catch (error) {
    console.error("Failed to start Ollama:", error);
    return false;
  }
}

export async function setupOllama(): Promise<boolean> {
  try {
    if (!(await checkOllamaInstallation())) {
      if (!(await installOllama())) {
        throw new Error("Failed to install Ollama");
      }
    }

    if (!(await checkOllamaRunning())) {
      if (!(await startOllama())) {
        throw new Error("Failed to start Ollama");
      }
    }

    if (!(await checkOllamaModel("llama3.2:3b"))) {
      if (!(await pullOllamaModel("llama3.2:3b"))) {
        throw new Error("Failed to pull llama3 model");
      }
    }

    if (!(await checkOllamaModel("nomic-embed-text"))) {
      if (!(await pullOllamaModel("nomic-embed-text"))) {
        throw new Error("Failed to pull nomic-embed-text model");
      }
    }

    console.log("✓ All requirements met! Ollama is ready.");
    return true;
  } catch (error) {
    console.error("Setup failed:", error);
    throw error;
  }
}

export async function stopOllama(): Promise<boolean> {
  try {
    console.log("Stopping Ollama server...");

    // Check if Ollama is running on port 11434
    try {
      const { stdout } = await execWithPath("lsof -i :11434 -t");
      if (stdout) {
        const pids = stdout.toString().split("\n").filter(Boolean);
        if (pids.length > 0) {
          // Kill processes found by lsof
          await execWithPath(`kill ${pids.join(" ")}`);

          // Verify processes are stopped
          await new Promise((resolve) => setTimeout(resolve, 1000));
          try {
            await execWithPath("lsof -i :11434");
            console.log(
              "! Ollama processes still running, attempting force kill...",
            );
            await execWithPath(`kill -9 ${pids.join(" ")}`);
          } catch {
            // If lsof fails, it means no processes are running - which is what we want
          }

          console.log("✓ Ollama server stopped");
          return true;
        }
      }
      console.log("No running Ollama processes found");
      return false;
    } catch (error) {
      if (error instanceof Error) {
        // If lsof returns non-zero, it means no processes were found
        console.log("No running Ollama processes found");
        return false;
      }
      throw error;
    }
  } catch (error) {
    console.error("Failed to stop Ollama:", error);
    return false;
  }
}
