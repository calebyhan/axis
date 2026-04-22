import { openDB } from "idb";
import type { SessionState } from "@/types";

const DB_NAME = "axis";
const STORE = "session_drafts";

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    },
  });
}

// Key is the session's startTime ISO string — one draft per session start time
export async function saveDraft(state: SessionState): Promise<void> {
  const db = await getDB();
  const key = state.startTime.toISOString();
  await db.put(STORE, {
    key,
    data: JSON.stringify({ ...state, startTime: key }),
  });
}

export async function getDraft(): Promise<{ state: SessionState; key: string } | null> {
  const db = await getDB();
  const all = await db.getAll(STORE);
  if (all.length === 0) return null;

  // Most recent draft first
  all.sort((a, b) => b.key.localeCompare(a.key));
  const record = all[0];

  try {
    const raw = JSON.parse(record.data) as SessionState & { startTime: string };
    const startTime = new Date(raw.startTime);
    if (isNaN(startTime.getTime())) {
      console.error("[session-draft] Invalid startTime in draft, clearing", { key: record.key });
      await db.delete(STORE, record.key).catch(() => {});
      return null;
    }
    return { state: { ...raw, startTime }, key: record.key };
  } catch (err) {
    console.error("[session-draft] Corrupt draft detected, clearing", {
      key: record.key,
      error: String(err),
    });
    await db.delete(STORE, record.key).catch(() => {});
    return null;
  }
}

export async function clearDraft(key?: string): Promise<void> {
  const db = await getDB();
  if (key) {
    await db.delete(STORE, key);
  } else {
    await db.clear(STORE);
  }
}
