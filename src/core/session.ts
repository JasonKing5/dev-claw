import Database from "better-sqlite3";
import type { ChatMessage } from "../types.js";

let db: Database.Database;

export function initDatabase(dbPath: string): void {
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
}

const stmtCache: {
  insert?: Database.Statement;
  select?: Database.Statement;
  clear?: Database.Statement;
} = {};

export function addMessage(userId: string, role: "user" | "assistant", content: string): void {
  stmtCache.insert ??= db.prepare(
    "INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)"
  );
  stmtCache.insert.run(userId, role, content);
}

export function getRecentMessages(userId: string, limit: number): ChatMessage[] {
  stmtCache.select ??= db.prepare(
    "SELECT role, content FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT ?"
  );
  const rows = stmtCache.select.all(userId, limit) as ChatMessage[];
  return rows.reverse();
}

export function clearHistory(userId: string): void {
  stmtCache.clear ??= db.prepare("DELETE FROM messages WHERE user_id = ?");
  stmtCache.clear.run(userId);
}
