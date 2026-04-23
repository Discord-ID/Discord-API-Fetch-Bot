function runtimeEnv(): Record<string, string | undefined> {
  const runtime = globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
    };
    Bun?: {
      env?: Record<string, string | undefined>;
    };
  };

  if (runtime.Bun?.env) {
    return runtime.Bun.env;
  }

  if (runtime.process?.env) {
    return runtime.process.env;
  }

  return {};
}

function readRequired(name: string): string {
  const value = runtimeEnv()[name];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function readOptional(name: string): string | undefined {
  const value = runtimeEnv()[name];

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed;
}

function readRequiredInteger(name: string): number {
  const value = readRequired(name);

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer`);
  }

  return parsed;
}

export const env = {
  discordBotToken: readRequired('DISCORD_BOT_TOKEN'),
  discordCollectiblesChannelId: readOptional('DISCORD_COLLECTIBLES_CHANNEL_ID'),
  discordQuestsChannelId: readOptional('DISCORD_QUESTS_CHANNEL_ID'),
  discordMentionCollectibles: readOptional('DISCORD_MENTION_COLLECTIBLES'),
  discordMentionQuests: readOptional('DISCORD_MENTION_QUESTS'),
  discordQuestsButtonUrl: readOptional('DISCORD_QUESTS_BUTTON_URL'),
  discordThreadAutoArchiveDuration: readOptional('DISCORD_THREAD_AUTO_ARCHIVE_DURATION')
    ? readRequiredInteger('DISCORD_THREAD_AUTO_ARCHIVE_DURATION')
    : 10080,
} as const;