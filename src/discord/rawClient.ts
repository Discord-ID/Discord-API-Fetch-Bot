import { env } from '../config/env';

type DiscordFileAttachment = {
  name: string;
  filePath: string;
};

type DiscordMessagePayload = {
  content?: string;
  flags?: number;
  components?: Array<Record<string, unknown>>;
  files?: DiscordFileAttachment[];
};

type DiscordMessageResponse = {
  id: string;
};

type CreateThreadInput = {
  channelId: string;
  messageId: string;
  name: string;
  autoArchiveDuration?: number;
};

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function discordRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = `https://discord.com/api/v10${path}`;
  const init = {
    method: 'POST' as const,
    headers: {
      Authorization: `Bot ${env.discordBotToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  };

  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, init);

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after')) || 1;
      await delay((retryAfter + 0.5) * 1000);
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord API request failed for ${path} with status ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  throw new Error(`Discord API request failed for ${path} after ${maxAttempts} rate limit retries`);
}

export async function sendMessage(channelId: string, payload: DiscordMessagePayload): Promise<DiscordMessageResponse> {
  if (!payload.files || payload.files.length === 0) {
    return discordRequest<DiscordMessageResponse>(`/channels/${channelId}/messages`, payload);
  }

  const { files, ...restPayload } = payload;
  const attachments = files.map((file, index) => ({
    id: String(index),
    filename: file.name,
  }));

  const formData = new FormData();
  formData.set('payload_json', JSON.stringify({
    ...restPayload,
    attachments,
  }));

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const handle = Bun.file(file.filePath);
    formData.set(`files[${index}]`, handle, file.name);
  }

  const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${env.discordBotToken}`,
        Accept: 'application/json',
      },
      body: formData,
    });

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after')) || 1;
      await delay((retryAfter + 0.5) * 1000);
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord API request failed for /channels/${channelId}/messages with status ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<DiscordMessageResponse>;
  }

  throw new Error(`Discord API file upload failed for /channels/${channelId}/messages after ${maxAttempts} rate limit retries`);
}

export async function createThreadFromMessage(input: CreateThreadInput): Promise<{ id: string }> {
  const payload: Record<string, unknown> = {
    name: input.name,
  };

  if (typeof input.autoArchiveDuration === 'number') {
    payload.auto_archive_duration = input.autoArchiveDuration;
  }

  return discordRequest<{ id: string }>(`/channels/${input.channelId}/messages/${input.messageId}/threads`, payload);
}