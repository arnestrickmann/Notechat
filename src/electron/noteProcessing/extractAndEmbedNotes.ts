import { execSync, spawn } from "child_process";
import * as crypto from "crypto";
import { DatabaseService } from "../database/databaseService.js";
import { CharChunker } from "./CharChunker.js";

const COUNT_SCRIPT = `
tell application "Notes"
    set noteCount to count of notes
end tell
`;

export function countNotes(): number {
  const output = execSync(`osascript -e '${COUNT_SCRIPT}'`).toString().trim();
  return parseInt(output, 10);
}

export async function generateEmbedding(text: string): Promise<Float32Array> {
  try {
    const response = await fetch("http://localhost:11434/api/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nomic-embed-text",
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate embedding: ${response.statusText}`);
    }

    const { embedding } = await response.json();
    const floatArray = new Float32Array(embedding);
    return floatArray;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Failed to generate embedding");
  }
}

const EXTRACT_SCRIPT = `
tell application "Notes"
   repeat with eachNote in every note
      set noteId to the id of eachNote
      set noteTitle to the name of eachNote
      set noteBody to the body of eachNote
      set noteCreatedDate to the creation date of eachNote
      set noteCreated to (noteCreatedDate as «class isot» as string)
      set noteUpdatedDate to the modification date of eachNote
      set noteUpdated to (noteUpdatedDate as «class isot» as string)
      set noteContainer to container of eachNote
      set noteFolderId to the id of noteContainer
      set noteFolderName to the name of noteContainer
      
      -- Start of note marker
      log "{split}START{split}"
      
      -- Output metadata
      log "{split}-id: " & noteId
      log "{split}-created: " & noteCreated
      log "{split}-updated: " & noteUpdated
      log "{split}-folderId: " & noteFolderId
      log "{split}-folderName: " & noteFolderName
      log "{split}-title: " & noteTitle
      
      -- Output body with clear markers
      log "{split}BODY_START{split}"
      log noteBody
      log "{split}BODY_END{split}"
      
      -- End of note marker
      log "{split}END{split}"
   end repeat
end tell
`.trim();

interface ProcessedNote {
  id: string;
  title: string;
  folderId: string;
  folderName: string;
  created: string;
  updated: string;
  body: string;
}

export interface ChunkMetadata {
  noteId: string;
  noteTitle: string;
  folderName: string;
  noteUpdated: string;
  chunkId: number;
  chunkIndex: number;
  chunkContent: string;
  embedding: Float32Array;
}

export async function extractAndEmbedNotes(
  dbService: DatabaseService,
): Promise<void> {
  console.log("Cleaning existing data from all tables...");
  dbService.cleanAllTables();
  console.log("Tables cleaned successfully. Starting extraction process...");

  let totalNotes = countNotes();
  let processedNotes = 1; // because of NOT NULL constraint from sqlite-vec
  let processedChunks = 0;

  const split = crypto.randomBytes(8).toString("hex");
  const process = spawn("osascript", [
    "-e",
    EXTRACT_SCRIPT.replace(/{split}/g, split),
  ]);

  type NoteSection = "body" | "metadata" | null;
  let currentSection: NoteSection = null;
  let note: Partial<ProcessedNote> = {};
  let body: string[] = [];

  process.stderr.on("data", async (data) => {
    const lines = data.toString("utf-8").split("\n");
    for (const line of lines) {
      const trimmedLine = line.trim();

      // Handle section markers
      if (trimmedLine === `${split}START${split}`) {
        note = {};
        body = [];
        currentSection = "metadata";
        continue;
      }

      if (trimmedLine === `${split}BODY_START${split}`) {
        currentSection = "body";
        continue;
      }

      if (trimmedLine === `${split}BODY_END${split}`) {
        currentSection = null;
        continue;
      }

      if (trimmedLine === `${split}END${split}`) {
        await processNote();
        currentSection = null;
        continue;
      }

      // Handle metadata
      if (
        currentSection === "metadata" &&
        trimmedLine.startsWith(`${split}-`)
      ) {
        const [key, ...valueParts] = trimmedLine
          .substring(`${split}-`.length)
          .split(": ");
        const value = valueParts.join(": "); // Rejoin in case value contains colons
        note[key as keyof ProcessedNote] = value;
        continue;
      }

      // Handle body content
      if (currentSection === "body") {
        body.push(trimmedLine);
      }
    }
  });

  const cleanText = (text: string): string => {
    const cleaned = text
      .replace(/<img[^>]*>/g, "") // Remove image tags and their contents
      .replace(/<[^>]*>/g, "") // Remove all HTML tags
      .replace(/\s+/g, " ") // Replace multiple whitespace characters (including newlines) with a single space
      // Remove any remaining HTML entities
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&[^;]+;/g, "")
      .replace(/\s{2,}/g, " ") // Clean up any double spaces that might have been created
      .trim();

    return cleaned;
  };

  const processNote = async () => {
    if (!note.id) return;

    try {
      processedNotes++;
      console.log(`\nProcessing Note ${processedNotes}/${totalNotes}:`);
      const processedNote: ProcessedNote = {
        id: note.id!,
        title: note.title || "",
        folderId: note.folderId || "",
        folderName: note.folderName || "",
        created: note.created || "",
        updated: note.updated || "",
        body: cleanText(body.join("\n")),
      };

      try {
        await dbService.saveNote({
          id: processedNote.id,
          title: processedNote.title,
          folderId: processedNote.folderId,
          folderName: processedNote.folderName,
          created: new Date(processedNote.created),
          updated: new Date(processedNote.updated),
        });

        console.log(`✓ Successfully saved Note:`, {
          id: processedNote.id,
          title: processedNote.title,
          folderName: processedNote.folderName,
          body: processedNote.body,
        });

        console.log(
          `Starting chunk processing for note: ${processedNote.title}`,
        );

        const chunker = new CharChunker({
          maxCharsPerChunk: 500,
          overlap: 50,
        });
        const chunks = chunker.createChunks(
          processedNote.body,
          processedNote.title,
        );
        console.log(`Created ${chunks.length} chunks for processing`);

        for (const [index, chunk] of chunks.entries()) {
          try {
            console.log(`Processing chunk ${index + 1}/${chunks.length}`);
            const embedding = await generateEmbedding(chunk);
            processedChunks++;

            const chunkMetadata: ChunkMetadata = {
              noteId: processedNote.id,
              noteTitle: processedNote.title,
              folderName: processedNote.folderName,
              noteUpdated: processedNote.updated,
              chunkId: processedChunks,
              chunkIndex: index,
              chunkContent: chunk,
              embedding: embedding,
            };

            await dbService.saveChunk(chunkMetadata);
            console.log(`✓ Successfully saved chunk ${processedChunks}:`, {
              noteId: chunkMetadata.noteId,
              noteTitle: chunkMetadata.noteTitle,
              chunkIndex: chunkMetadata.chunkIndex + 1,
              contentPreview:
                chunkMetadata.chunkContent.substring(0, 50) + "...",
              embeddingLength: chunkMetadata.embedding.length,
            });
            chunkMetadata.embedding = new Float32Array(0); // Clear the embedding
          } catch (error) {
            console.error(
              `Error processing chunk ${index + 1} of note ${processedNote.id}:`,
              error,
            );
          }
        }

        console.log(
          `Completed processing all chunks for note: ${processedNote.title}\n`,
        );

        // Clear memory-heavy content after processing
        processedNote.body = ""; // Clear the body
        body = []; // Clear the body array
        note = {}; // Clear the note object
        global.gc?.(); // Suggest garbage collection
      } catch (error) {
        console.log(`✗ Failed to save Note`, {
          id: processedNote.id,
          title: processedNote.title,
          folderName: processedNote.folderName,
        });
      }
    } catch (error) {
      console.error(`Error processing note ${note.id}:`, error);
    } finally {
      note = {};
      body = [];
      currentSection = null;
    }
  };

  return new Promise((resolve, reject) => {
    process.on("close", async (code: number) => {
      try {
        if (note.id) {
          await processNote();
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
        console.log("\nProcessing Summary:");
        console.log(`Total notes processed: ${processedNotes - 1}/${totalNotes}`);
        console.log(`Total chunks processed: ${processedChunks}`);

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Notes extraction failed with code ${code}`));
        }
      } catch (error) {
        console.error("Error during process completion:", error);
        reject(error);
      }
    });
  });
}
