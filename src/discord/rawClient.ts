import { env } from '../config/env';

type DiscordFileAttachment = {
  name: string;
  filePath?: string;
  buffer?: Buffer;
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
    let fileHandle: Blob;
    
    if (file.buffer) {
      // Use buffer directly - convert Buffer to Uint8Array for Blob compatibility
      // Specify image/png MIME type so Discord recognizes it as a PNG image
      fileHandle = new Blob([new Uint8Array(file.buffer)], { type: 'image/png' });
      console.log(`[DEBUG] Uploading buffer file: ${file.name}, size: ${file.buffer.length} bytes`);
    } else if (file.filePath) {
      // Use file from disk
      fileHandle = Bun.file(file.filePath);
      console.log(`[DEBUG] Uploading file from disk: ${file.name}, path: ${file.filePath}`);
    } else {
      throw new Error(`File attachment ${file.name} has neither buffer nor filePath`);
    }
    
    formData.set(`files[${index}]`, fileHandle, file.name);
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
      console.error(`[DEBUG] Discord API upload failed with status ${response.status}: ${errorText}`);
      throw new Error(`Discord API request failed for /channels/${channelId}/messages with status ${response.status}: ${errorText}`);
    }

    const result = await response.json() as DiscordMessageResponse;
    console.log(`[DEBUG] Discord API upload succeeded, message ID: ${result.id}`);
    return result;
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