import { fetchCollectibles } from './api/collectibles';
import { fetchQuests } from './api/quests';
import { env } from './config/env';
import { createThreadFromMessage, sendMessage } from './discord/rawClient';
import {
  buildCollectibleDetailPayloads,
  buildCollectibleStarterPayload,
  buildThreadName,
  groupCollectibleCategories,
} from './builders/collectibles';
import { buildQuestPayload } from './builders/quests';
import { loadState, saveState } from './state';

const DELAY_BETWEEN_POSTS_MS = 1_000;
const DELAY_BEFORE_THREAD_CREATE_MS = 2_500;
const THREAD_CREATE_RETRY_DELAY_MS = 2_000;
const THREAD_CREATE_MAX_ATTEMPTS = 4;

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function createThreadWithRetry(input: {
  channelId: string;
  messageId: string;
  name: string;
  autoArchiveDuration: number;
}): Promise<{ id: string }> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= THREAD_CREATE_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await createThreadFromMessage(input);
    } catch (error) {
      lastError = error;
      if (attempt < THREAD_CREATE_MAX_ATTEMPTS) {
        await delay(THREAD_CREATE_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}

function isActiveQuest(startsAt: string, expiresAt: string): boolean {
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = new Date(expiresAt).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return false;
  }

  return start <= now && now < end;
}

async function run(): Promise<void> {
  const state = loadState();
  const [collectibles, quests] = await Promise.all([fetchCollectibles(), fetchQuests()]);

  const collectibleQueue = collectibles
    .map((release) => ({
      release,
      groups: groupCollectibleCategories(release),
    }))
    .filter((entry) => entry.groups.length > 0 && !state.seenCollectibleIds.includes(entry.release.sku_id));

  const newQuests = quests
    .filter((quest) => !state.seenQuestIds.includes(quest.id))
    .sort((a, b) => new Date(a.config.starts_at).getTime() - new Date(b.config.starts_at).getTime());

  console.log(`Fetched ${quests.length} quest ids from API, ${newQuests.length} new quests will be posted.`);

  if (collectibleQueue.length === 0 && newQuests.length === 0) {
    console.log('No new quests or collectibles to post.');
    return;
  }

  if (collectibleQueue.length > 0) {
    if (!env.discordCollectiblesChannelId) {
      throw new Error('Missing required environment variable: DISCORD_COLLECTIBLES_CHANNEL_ID');
    }

    if (!env.discordMentionCollectibles) {
      throw new Error('Missing required environment variable: DISCORD_MENTION_COLLECTIBLES');
    }
  }

  if (newQuests.length > 0) {
    if (!env.discordQuestsChannelId) {
      throw new Error('Missing required environment variable: DISCORD_QUESTS_CHANNEL_ID');
    }

    if (!env.discordMentionQuests) {
      throw new Error('Missing required environment variable: DISCORD_MENTION_QUESTS');
    }
  }

  for (let collectibleIndex = 0; collectibleIndex < collectibleQueue.length; collectibleIndex += 1) {
    const { release, groups } = collectibleQueue[collectibleIndex];

    const starterPayload = buildCollectibleStarterPayload(release, env.discordMentionCollectibles ?? '');
    const parentMessage = await sendMessage(env.discordCollectiblesChannelId!, starterPayload);

    await delay(DELAY_BEFORE_THREAD_CREATE_MS);

    const thread = await createThreadWithRetry({
      channelId: env.discordCollectiblesChannelId!,
      messageId: parentMessage.id,
      name: buildThreadName(release),
      autoArchiveDuration: env.discordThreadAutoArchiveDuration,
    });

    for (const group of groups) {
      const detailPayloads = buildCollectibleDetailPayloads(release, group.type);
      for (const detailPayload of detailPayloads) {
        await sendMessage(thread.id, detailPayload);
        await delay(DELAY_BETWEEN_POSTS_MS);
      }
    }

    state.seenCollectibleIds.push(release.sku_id);
    saveState(state);

    if (collectibleIndex < collectibleQueue.length - 1) {
      await delay(DELAY_BETWEEN_POSTS_MS);
    }
  }

  for (let questIndex = 0; questIndex < newQuests.length; questIndex += 1) {
    const quest = newQuests[questIndex];
    const payload = buildQuestPayload(quest, env.discordMentionQuests ?? '', env.discordQuestsButtonUrl);
    const orbsFilePath = typeof (globalThis as any).process?.cwd === 'function'
      ? (globalThis as any).process.cwd() + '/assets/orbs.png'
      : './assets/orbs.png';

    const message = await sendMessage(env.discordQuestsChannelId!, {
      flags: payload.flags,
      components: payload.components,
      files: payload.requiresOrbsAttachment
        ? [
            {
              name: 'orbs.png',
              filePath: orbsFilePath,
            },
          ]
        : undefined,
    });

    state.seenQuestIds.push(quest.id);
    saveState(state);

    if (questIndex < newQuests.length - 1) {
      await delay(DELAY_BETWEEN_POSTS_MS);
    }
  }
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  const runtime = globalThis as {
    process?: {
      exit(code: number): void;
    };
  };

  runtime.process?.exit(1);
});
