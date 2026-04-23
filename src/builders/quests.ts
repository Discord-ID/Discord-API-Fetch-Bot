const QUESTS_CDN = 'https://cdn.discordapp.com';

import { QuestEntry, QuestReward, QuestTask } from '../types/quest';

type DiscordComponent = Record<string, unknown>;

function toUnixTimestamp(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}

function platformLabel(platforms: number[] | undefined): string {
  if (!platforms || platforms.length === 0) {
    return 'Cross Platform';
  }

  if (platforms.includes(0)) {
    return 'Cross Platform';
  }

  const labels = platforms.map((platform) => {
    switch (platform) {
      case 1:
        return 'Xbox';
      case 2:
        return 'PlayStation';
      case 3:
        return 'Switch';
      case 4:
        return 'PC';
      default:
        return `Platform ${platform}`;
    }
  });

  return labels.join(', ');
}

function rewardTypeLabel(type: number): string {
  switch (type) {
    case 1:
      return 'Collectible';
    case 3:
      return 'Avatar Decoration';
    case 4:
      return 'Orbs';
    default:
      return `Type ${type}`;
  }
}

function hasImageExtension(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.endsWith('.png') || normalized.endsWith('.jpg') || normalized.endsWith('.jpeg') || normalized.endsWith('.webp') || normalized.endsWith('.gif');
}

function hasVideoExtension(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.endsWith('.mp4') || normalized.endsWith('.mov') || normalized.endsWith('.webm');
}

function toWebpPoster(url: string): string {
  return `${url}?format=webp`;
}

function taskLine(task: QuestTask): string {
  const prettyType = task.type.replaceAll('_', ' ').toLowerCase();
  const prettyName = prettyType.charAt(0).toUpperCase() + prettyType.slice(1);
  let timeStr = '';
  if (task.target >= 60) {
    const minutes = Math.floor(task.target / 60);
    const seconds = task.target % 60;
    if (seconds === 0) {
      timeStr = `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      timeStr = `${minutes} minute${minutes > 1 ? 's' : ''} ${seconds} second${seconds > 1 ? 's' : ''}`;
    }
  } else {
    timeStr = `${task.target} second${task.target > 1 ? 's' : ''}`;
  }
  return `- ${prettyName} (${timeStr})`;
}

function resolveAssetUrl(questId: string, assetName?: string | null): string | undefined {
  if (typeof assetName !== 'string' || assetName.length === 0) {
    return undefined;
  }

  if (assetName.startsWith('http://') || assetName.startsWith('https://')) {
    return assetName;
  }

  // Handle already-prefixed paths (e.g., "quests/1475987384116973579/...")
  if (assetName.startsWith('quests/')) {
    return `${QUESTS_CDN}/${assetName}`;
  }

  return `${QUESTS_CDN}/quests/${questId}/${assetName}`;
}

function rewardImageUrl(questId: string, reward: QuestReward): string | undefined {
  // Accessory thumbnail must be image file.
  if (reward.asset && hasImageExtension(reward.asset)) {
    return resolveAssetUrl(questId, reward.asset);
  }

  if (reward.type === 4 && typeof reward.orb_quantity === 'number') {
    return 'attachment://orbs.png';
  }

  // Avatar decoration often ships as mp4; Discord CDN can return an image poster via ?format=webp.
  if (reward.type === 3 && reward.asset && hasVideoExtension(reward.asset)) {
    const videoUrl = resolveAssetUrl(questId, reward.asset);
    return videoUrl ? toWebpPoster(videoUrl) : undefined;
  }

  return undefined;
}

function rewardVideoUrl(questId: string, reward: QuestReward): string | undefined {
  if (reward.asset_video && hasVideoExtension(reward.asset_video)) {
    return resolveAssetUrl(questId, reward.asset_video);
  }

  // Some decoration rewards place video in `asset` (not `asset_video`).
  if (reward.asset && hasVideoExtension(reward.asset)) {
    return resolveAssetUrl(questId, reward.asset);
  }

  return undefined;
}

function questTaskVideoUrl(quest: QuestEntry): string | undefined {
  const tasks = quest.config.task_config_v2?.tasks ?? {};
  
  // Get first task with video
  for (const task of Object.values(tasks)) {
    const videoUrl = task.assets?.video?.url;
    if (videoUrl) {
      return resolveAssetUrl(quest.id, videoUrl);
    }
  }
  
  return undefined;
}

function questHeroImageUrl(quest: QuestEntry): string {
  const questId = quest.id;
  const media = quest.config.assets;

  // Prefer hero over quest_bar_hero for better quality
  const candidates = [
    resolveAssetUrl(questId, media.hero),
    resolveAssetUrl(questId, media.quest_bar_hero),
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  throw new Error(`Quest ${quest.id} does not contain a usable hero image`);
}

function questHeader(quest: QuestEntry): string {
  const questUrl = `https://canary.discord.com/quests/${quest.id}`;
  return `## **New Quest** - [${quest.config.messages.quest_name}](${questUrl})`;
}

function questInfoBlock(quest: QuestEntry): string {
  const config = quest.config;
  const start = toUnixTimestamp(config.starts_at);
  const end = toUnixTimestamp(config.expires_at);
  const applicationLine = config.application.link
    ? `[${config.application.name}](${config.application.link}) (\`${config.application.id}\`)`
    : `${config.application.name} (\`${config.application.id}\`)`;

  const gameTitle = config.messages.game_title ?? config.messages.quest_name;
  const gamePublisher = config.messages.game_publisher ?? 'Unknown Publisher';
  const features = config.features.length > 0 ? config.features.map((feature) => `\`${feature}\``).join(', ') : '`NONE`';

  return [
    '# Quest Info',
    `**Duration**: <t:${start}:d> - <t:${end}:d>`,
    `**Reedemable Platforms**: ${platformLabel(config.rewards_config?.platforms)}`,
    `**Game**: ${gameTitle} (${gamePublisher})`,
    `**Application**: ${applicationLine}`,
    `**Features**: ${features}`,
  ].join('\n');
}

function tasksBlock(quest: QuestEntry): string {
  const tasks = Object.values(quest.config.task_config_v2?.tasks ?? {});

  if (tasks.length === 0) {
    return '# Tasks\nNo tasks were found in this quest payload';
  }

  const lines = tasks.map(taskLine);
  return ['# Tasks', 'User must complete any of the following tasks', ...lines].join('\n');
}

function rewardSection(quest: QuestEntry, reward: QuestReward): DiscordComponent {
  const rewardName = reward.messages?.name ?? 'Unknown Reward';
  const rewardThumb = rewardImageUrl(quest.id, reward);
  const rewardText = [
    '# Rewards',
    `**Reward Type**: ${rewardTypeLabel(reward.type)}`,
    `**SKU ID**: \`${reward.sku_id ?? 'N/A'}\``,
    `**Name**: ${rewardName}`,
  ].join('\n');

  // Only use Type 9 (media + text) if there's a thumbnail
  // Otherwise use Type 10 (text only) to avoid "accessory required" error
  if (rewardThumb) {
    return {
      type: 9,
      accessory: {
        type: 11,
        media: {
          url: rewardThumb,
        },
        spoiler: false,
      },
      components: [
        {
          type: 10,
          content: rewardText,
        },
      ],
    };
  }

  // For rewards without media (e.g., Orbs), use text-only component
  return {
    type: 10,
    content: rewardText,
  };
}

function rewardVideoSection(quest: QuestEntry, reward: QuestReward): DiscordComponent | undefined {
  const videoUrl = rewardVideoUrl(quest.id, reward);

  if (!videoUrl) {
    return undefined;
  }

  return {
    type: 12,
    items: [
      {
        media: {
          url: videoUrl,
        },
        spoiler: false,
      },
    ],
  };
}

export function buildQuestPayload(
  quest: QuestEntry,
  mention?: string,
  buttonUrl?: string,
): {
  flags: number;
  components: DiscordComponent[];
  requiresOrbsAttachment: boolean;
} {
  const heroImage = questHeroImageUrl(quest);
  const rewards = quest.config.rewards_config?.rewards ?? [];
  const selectedVideo = questTaskVideoUrl(quest);
  const requiresOrbsAttachment = rewards.some((reward) => reward.type === 4 && typeof reward.orb_quantity === 'number');

  const components: DiscordComponent[] = [
    {
      type: 10,
      content: questHeader(quest),
    },
    // Hero image (always)
    {
      type: 12,
      items: [
        {
          media: {
            url: heroImage,
          },
          spoiler: false,
        },
      ],
    },
    {
      type: 14,
      divider: true,
      spacing: 1,
    },
    {
      type: 10,
      content: questInfoBlock(quest),
    },
    {
      type: 14,
      divider: true,
      spacing: 1,
    },
    {
      type: 10,
      content: tasksBlock(quest),
    },
  ];

  // Rewards section
  for (const reward of rewards) {
    components.push({
      type: 14,
      divider: true,
      spacing: 1,
    });

    components.push(rewardSection(quest, reward));
  }

  // One video only: task video from quest task assets.
  if (selectedVideo) {
    components.push({
      type: 14,
      divider: true,
      spacing: 1,
    });
    components.push({
      type: 12,
      items: [
        {
          media: {
            url: selectedVideo,
          },
          spoiler: false,
        },
      ],
    });
  }

  components.push(
    {
      type: 10,
      content: `Quest ID: \`${quest.id}\``,
    },
  );

  const payloadComponents: DiscordComponent[] = [
    {
      type: 17,
      accent_color: null,
      spoiler: false,
      components,
    },
  ];

  if (mention || buttonUrl) {
    const mentionString = mention ?? '';
    const mentionComponent: DiscordComponent = {
      type: 9,
      components: [
        {
          type: 10,
          content: mentionString || ' ',
        },
      ],
    };

    if (buttonUrl) {
      mentionComponent.accessory = {
        type: 2,
        style: 5,
        label: 'Discord ID',
        emoji: null,
        disabled: false,
        url: buttonUrl,
      };
    }

    payloadComponents.push(mentionComponent);
  }

  return {
    flags: 32768,
    requiresOrbsAttachment,
    components: payloadComponents,
  };
}
