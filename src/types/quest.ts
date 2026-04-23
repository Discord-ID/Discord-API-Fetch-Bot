export interface QuestTaskVideo {
	url?: string;
	width?: number;
	height?: number;
	thumbnail?: string;
}

export interface QuestTaskAssets {
	video?: QuestTaskVideo;
	video_low_res?: QuestTaskVideo;
	video_hls?: QuestTaskVideo;
}

export interface QuestTask {
	type: string;
	target: number;
	assets?: QuestTaskAssets;
}

export interface QuestRewardMessages {
	name?: string;
}

export interface QuestReward {
	type: number;
	sku_id?: string;
	asset?: string;
	asset_video?: string | null;
	messages?: QuestRewardMessages;
	orb_quantity?: number;
	premium_orb_quantity?: number | null;
}

export interface QuestConfig {
	id: string;
	starts_at: string;
	expires_at: string;
	features: string[];
	application: {
		id: string;
		name: string;
		link?: string;
	};
	assets: {
		hero?: string;
		quest_bar_hero?: string;
		hero_video?: string | null;
		quest_bar_hero_video?: string | null;
	};
	messages: {
		quest_name: string;
		game_title?: string;
		game_publisher?: string;
	};
	task_config_v2?: {
		tasks?: Record<string, QuestTask>;
	};
	rewards_config?: {
		rewards?: QuestReward[];
		rewards_expire_at?: string;
		platforms?: number[];
	};
}

export interface QuestEntry {
	id: string;
	config: QuestConfig;
}
