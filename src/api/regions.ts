import { fetchJson } from "../utils/fetcher";

const REGIONS_ENDPOINT = "https://api.discordquest.com/api/regions";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export interface QuestRegionInfo {
  id: string;
  isGlobal: boolean;
  include: string[];
  exclude: string[];
  showAgeGate: boolean;
  replacementId?: string;
}

export async function fetchRegions(): Promise<Map<string, QuestRegionInfo>> {
  const payload = await fetchJson<unknown>(REGIONS_ENDPOINT);

  if (!isRecord(payload) || !Array.isArray(payload.quests)) {
    throw new Error("Invalid regions response");
  }

  const map = new Map<string, QuestRegionInfo>();

  for (const quest of payload.quests) {
    if (!isRecord(quest)) continue;

    const id = typeof quest.id === "string" ? quest.id : undefined;
    if (!id) continue;

    const include: string[] = [];
    const exclude: string[] = [];

    if (Array.isArray(quest.regions)) {
      for (const region of quest.regions) {
        if (typeof region === "string") {
          include.push(region);
        }
      }
    } else if (isRecord(quest.regions)) {
      if (Array.isArray(quest.regions.include)) {
        for (const region of quest.regions.include) {
          if (typeof region === "string") {
            include.push(region);
          }
        }
      }

      if (Array.isArray(quest.regions.exclude)) {
        for (const region of quest.regions.exclude) {
          if (typeof region === "string") {
            exclude.push(region);
          }
        }
      }
    }

    map.set(id, {
      id,
      isGlobal: quest.is_global === true,
      include,
      exclude,
      showAgeGate: quest.show_age_gate === true,
      replacementId:
        typeof quest.replacement_id === "string"
          ? quest.replacement_id
          : undefined,
    });
  }

  console.log(`Loaded ${map.size} region entries.`);

  return map;
}