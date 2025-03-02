import BetterSqlite3 from "better-sqlite3";
import fs from "fs";
import path from "path";
import { getDatabasePath } from "../pathResolver.js";
import {
  generateEmbedding,
  ChunkMetadata,
} from "../noteProcessing/extractAndEmbedNotes.js";
import { app } from "electron";

export class DatabaseService {
  private static instance: DatabaseService;
  private vectorDb: BetterSqlite3.Database;
  private dbPath: string;
  private requiredTables = ["Notes", "Chunks", "ChunkEmbeddings"];

  constructor() {
    this.dbPath = getDatabasePath();
    const dbDir = path.dirname(this.dbPath);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    

    // Get the correct path for better-sqlite3.node
    const betterSqlitePath = path.join(
      app.getAppPath().replace("app.asar", "app.asar.unpacked"),
      "node_modules",
      "better-sqlite3",
      "build",
      "Release",
      "better_sqlite3.node",
    );

    if (!fs.existsSync(betterSqlitePath)) {
      console.error(
        "better-sqlite3.node not found at expected path:",
        betterSqlitePath,
      );
      throw new Error(`better-sqlite3.node not found at ${betterSqlitePath}`);
    }

    // Initialize with explicit native module path
    this.vectorDb = new BetterSqlite3(this.dbPath, {
      nativeBinding: betterSqlitePath,
      // uncomment to add logging for debugging
      //verbose: console.log,
    });

    // Get vec0.dylib path
    const vecDylibPath = path.join(
      app.getAppPath().replace("app.asar", "app.asar.unpacked"),
      "node_modules",
      "sqlite-vec-darwin-arm64",
      "vec0.dylib",
    );

    if (!fs.existsSync(vecDylibPath)) {
      console.error("vec0.dylib not found at expected path:", vecDylibPath);
      throw new Error(`vec0.dylib not found at ${vecDylibPath}`);
    }

    this.vectorDb.loadExtension(vecDylibPath);

    // Initialize schema
    this.initializeSchema();
    this.checkRequiredTables();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private tableExists(tableName: string): boolean {
    const result = this.vectorDb
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type='table' 
      AND name = ?
    `,
      )
      .get(tableName) as { count: number };

    return result.count > 0;
  }

  private checkRequiredTables() {
    console.log("\nChecking required tables:");
    for (const table of this.requiredTables) {
      const exists = this.tableExists(table);
      console.log(`- ${table}: ${exists ? "✓" : "✗"}`);

      if (exists) {
        // Get row count for each table
        const countResult = this.vectorDb
          .prepare(`SELECT COUNT(*) as count FROM ${table}`)
          .get() as { count: number };
        console.log(`  Rows: ${countResult.count}`);
      }
    }
  }

  private initializeSchema() {
    try {
      // Enable foreign key support
      this.vectorDb.exec("PRAGMA foreign_keys=ON;");

      // Create all tables in one database
      this.vectorDb.exec(`
        CREATE TABLE IF NOT EXISTS Notes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          folderId TEXT NOT NULL,
          folderName TEXT NOT NULL,
          created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

       CREATE TABLE IF NOT EXISTS Chunks (
          chunkId TEXT PRIMARY KEY,
          noteId TEXT NOT NULL,
          noteTitle TEXT NOT NULL,
          folderName TEXT NOT NULL,
          noteUpdated TEXT NOT NULL,
          chunkIndex INTEGER NOT NULL,
          chunkContent TEXT NOT NULL,
          FOREIGN KEY (noteId) REFERENCES Notes(id) ON DELETE CASCADE
        );
      `);

      this.vectorDb.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS ChunkEmbeddings USING vec0(
          chunkId integer primary key,
          folderName TEXT NOT NULL,
          embedding float[768]
        );`);

      console.log("Database schema initialized");
    } catch (error) {
      console.error("Database initialization failed:", error);
      throw error;
    }
  }

  public cleanAllTables(): void {
    try {
      // Begin a transaction to ensure data consistency
      const transaction = this.vectorDb.transaction(() => {
        // Disable foreign key constraints temporarily
        this.vectorDb.exec("PRAGMA foreign_keys=OFF;");
        // Delete data from all tables
        for (const table of this.requiredTables) {
          this.vectorDb.prepare(`DELETE FROM ${table}`).run();
        }
        // Re-enable foreign key constraints
        this.vectorDb.exec("PRAGMA foreign_keys=ON;");
      });
      // Execute the transaction
      transaction();

      console.log("All tables have been cleaned successfully");
    } catch (error) {
      console.error("Error cleaning tables:", error);
      throw error;
    }
  }

  async saveNote(noteData: {
    id: string;
    title: string;
    folderId: string;
    folderName: string;
    created: Date;
    updated: Date;
  }): Promise<void> {
    const stmt = this.vectorDb.prepare(`
      INSERT OR REPLACE INTO Notes (id, title, folderId, folderName, created, updated)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      noteData.id,
      noteData.title,
      noteData.folderId,
      noteData.folderName,
      noteData.created.toISOString(),
      noteData.updated.toISOString(),
    );
  }

  public getNotesInDb(): number {
    try {
      const result = this.vectorDb
        .prepare("SELECT COUNT(*) as count FROM Notes")
        .get() as { count: number };

      return result.count;
    } catch (error) {
      console.error("Error getting note count:", error);
      throw error;
    }
  }

  public getFoldersInDb(): string[] {
    try {
      const stmt = this.vectorDb.prepare(`
      SELECT DISTINCT folderName 
      FROM Notes 
      ORDER BY folderName ASC
    `);

      const results = stmt.all() as Array<{ folderName: string }>;
      return results.map((row) => row.folderName);
    } catch (error) {
      console.error("Error getting folder names:", error);
      throw error;
    }
  }

  async saveChunk(chunkMetadata: ChunkMetadata): Promise<void> {
    const chunkStmt = this.vectorDb.prepare(`
    INSERT OR REPLACE INTO Chunks (
      chunkId,
      noteId,
      noteTitle,
      folderName,
      noteUpdated,
      chunkIndex,
      chunkContent
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    const embeddingStmt = this.vectorDb.prepare(
      "INSERT OR REPLACE INTO ChunkEmbeddings(chunkId, folderName, embedding) VALUES (?, ?, ?)",
    );

    // Use a transaction to ensure both inserts succeed or fail together
    const transaction = this.vectorDb.transaction(() => {
      // Insert chunk metadata
      chunkStmt.run(
        chunkMetadata.chunkId,
        chunkMetadata.noteId,
        chunkMetadata.noteTitle,
        chunkMetadata.folderName,
        chunkMetadata.noteUpdated,
        chunkMetadata.chunkIndex,
        chunkMetadata.chunkContent,
      );

      // Insert embedding vector
      embeddingStmt.run(
        BigInt(chunkMetadata.chunkId),
        chunkMetadata.folderName,
        chunkMetadata.embedding,
      );
    });

    transaction();
  }

  async findSimilarChunks(
    queryText: string,
    limit: number = 5,
    distanceThreshold: number = 19,
    folderName?: string,
  ): Promise<
    Array<{
      chunkId: string;
      noteTitle: string;
      noteUpdated: string;
      chunkContent: string;
      distance: number;
    }>
  > {
    const queryEmbedding = await generateEmbedding(queryText);

    const stmt = this.vectorDb.prepare(`
    WITH similar_chunks AS (
      SELECT 
        chunkId,
        distance
      FROM ChunkEmbeddings e
      WHERE embedding MATCH ?
        AND k = ?
        AND distance < ?
        ${folderName ? "AND e.folderName = ?" : ""}
      ORDER BY distance ASC
    )
    SELECT 
      s.chunkId,
      c.noteTitle,
      c.noteUpdated,
      c.chunkContent,
      s.distance
    FROM similar_chunks s
    JOIN Chunks c ON CAST(c.chunkId AS INTEGER) = s.chunkId
    ORDER BY s.distance ASC
  `);

    const params = folderName
      ? [queryEmbedding, limit, distanceThreshold, folderName]
      : [queryEmbedding, limit, distanceThreshold];

    const results = stmt.all(...params) as Array<{
      chunkId: string;
      noteTitle: string;
      noteUpdated: string;
      chunkContent: string;
      distance: number;
    }>;

    console.log(results);
    return results;
  }

  async close(): Promise<void> {
    this.vectorDb.close();
  }
}
