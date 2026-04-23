import { fetchJson } from '../utils/fetcher';
import { QuestEntry } from '../types/quest';

const QUESTS_ENDPOINT = 'https://api.discordquest.com/api/quests';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required field: ${fieldName}`);
  }

  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function readNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry));
}

function normalizeQuest(item: unknown): QuestEntry {
  if (!isRecord(item)) {
    throw new Error('Quest entry must be an object');
  }

  const config = item.config;
  if (!isRecord(config)) {
    throw new Error('Quest config is missing');
  }

  const application = isRecord(config.application) ? config.application : {};
  const assets = isRecord(config.assets) ? config.assets : {};
  const messages = isRecord(config.messages) ? config.messages : {};
  const taskConfigV2 = isRecord(config.task_config_v2) ? config.task_config_v2 : undefined;
  const rewardsConfig = isRecord(config.rewards_config) ? config.rewards_config : undefined;

  const tasksRaw = taskConfigV2 && isRecord(taskConfigV2.tasks) ? taskConfigV2.tasks : {};
  const tasks: Record<string, { type: string; target: number; assets?: any }> = {};

  for (const [key, value] of Object.entries(tasksRaw)) {
    if (!isRecord(value)) {
      continue;
    }

    const typeValue = readOptionalString(value.type) ?? key;
    const targetValue = typeof value.target === 'number' ? value.target : 0;
    const assetsValue = isRecord(value.assets) ? value.assets : undefined;

    tasks[key] = {
      type: typeValue,
      target: targetValue,
      assets: assetsValue,
    };
  }

  const rewardsRaw = rewardsConfig && Array.isArray(rewardsConfig.rewards) ? rewardsConfig.rewards : [];

  return {
    id: readString(item.id, 'id'),
    config: {
      id: readString(config.id, 'config.id'),
      starts_at: readString(config.starts_at, 'config.starts_at'),
      expires_at: readString(config.expires_at, 'config.expires_at'),
      features: readStringArray(config.features),
      application: {
        id: readString(application.id, 'config.application.id'),
        name: readString(application.name, 'config.application.name'),
        link: readOptionalString(application.link),
      },
      assets: {
        hero: readOptionalString(assets.hero),
        quest_bar_hero: readOptionalString(assets.quest_bar_hero),
        hero_video: readOptionalString(assets.hero_video) ?? null,
        quest_bar_hero_video: readOptionalString(assets.quest_bar_hero_video) ?? null,
      },
      messages: {
        quest_name: readString(messages.quest_name, 'config.messages.quest_name'),
        game_title: readOptionalString(messages.game_title),
        game_publisher: readOptionalString(messages.game_publisher),
      },
      task_config_v2: {
        tasks,
      },
      rewards_config: {
        rewards: rewardsRaw
          .map((reward) => {
            if (!isRecord(reward)) {
              return undefined;
            }

            const rewardMessages = isRecord(reward.messages) ? reward.messages : undefined;

            return {
              type: typeof reward.type === 'number' ? reward.type : 0,
              sku_id: readOptionalString(reward.sku_id),
              asset: readOptionalString(reward.asset),
              asset_video: readOptionalString(reward.asset_video) ?? null,
              messages: rewardMessages
                ? {
                    name: readOptionalString(rewardMessages.name),
                  }
                : undefined,
              orb_quantity: typeof reward.orb_quantity === 'number' ? reward.orb_quantity : undefined,
              premium_orb_quantity: reward.premium_orb_quantity ?? null,
            };
          })
          .filter((reward): reward is NonNullable<typeof reward> => Boolean(reward)),
        rewards_expire_at: rewardsConfig ? readOptionalString(rewardsConfig.rewards_expire_at) : undefined,
        platforms: rewardsConfig ? readNumberArray(rewardsConfig.platforms) : [],
      },
    },
  };
}

export async function fetchQuests(): Promise<QuestEntry[]> {
  const payload = await fetchJson<unknown>(QUESTS_ENDPOINT);

  if (!Array.isArray(payload)) {
    throw new Error('Quests API response must be an array');
  }

  const normalized: QuestEntry[] = [];

  for (const item of payload) {
    try {
      normalized.push(normalizeQuest(item));
    } catch {
      continue;
    }
  }

  if (normalized.length === 0) {
    throw new Error('Quests API did not return any valid quest entries');
  }

  return normalized;
}
