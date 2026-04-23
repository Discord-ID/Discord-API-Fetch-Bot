import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const STATE_FILE = path.resolve(fileURLToPath(new URL('../state.json', import.meta.url)));

const DEFAULT_STATE = {
  seenQuestIds: [] as string[],
  seenCollectibleIds: [] as string[],
};

function fileExists(pathToFile: string): boolean {
  return existsSync(pathToFile);
}

function readFile(pathToFile: string): string {
  return readFileSync(pathToFile, 'utf8');
}

function writeFile(pathToFile: string, data: string): void {
  writeFileSync(pathToFile, data, 'utf8');
}

export function loadState() {
  if (!fileExists(STATE_FILE)) {
    return { ...DEFAULT_STATE };
  }

  try {
    const raw = readFile(STATE_FILE).trim();
    if (!raw) {
      return { ...DEFAULT_STATE };
    }

    const parsed = JSON.parse(raw) as {
      seenQuestIds?: unknown;
      seenCollectibleIds?: unknown;
    };

    return {
      ...DEFAULT_STATE,
      ...parsed,
      seenQuestIds: Array.isArray(parsed.seenQuestIds) ? parsed.seenQuestIds : [],
      seenCollectibleIds: Array.isArray(parsed.seenCollectibleIds) ? parsed.seenCollectibleIds : [],
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state: { seenQuestIds: string[]; seenCollectibleIds: string[] }): void {
  writeFile(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}
