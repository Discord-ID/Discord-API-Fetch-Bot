export interface CollectiblePriceEntry {
	amount: number;
	currency: string;
	exponent: number;
}

export interface CollectibleCountryPrices {
	country_code: string;
	prices: CollectiblePriceEntry[];
}

export interface CollectiblePriceGroup {
	country_prices: CollectibleCountryPrices;
}

export interface CollectiblePriceMap {
	[key: string]: CollectiblePriceGroup;
}

export interface CollectibleAsset {
	url?: string;
}

export interface CollectibleItemAssetMap {
	static_image_url?: string;
	animated_image_url?: string;
}

export interface CollectibleItemEntry {
	type: number;
	sku_id: string;
	asset?: string;
	assets?: CollectibleItemAssetMap;
	thumbnailPreviewSrc?: string;
	label?: string | null;
}

export interface CollectibleProduct {
	sku_id: string;
	name: string;
	summary: string | null;
	styles: Record<string, unknown>;
	prices: CollectiblePriceMap;
	preview_assets: CollectibleAsset[];
	items: CollectibleItemEntry[];
	type: number;
	premium_type: number;
	category_sku_id: string;
	google_sku_ids: string[];
}

export interface CollectibleRelease {
	sku_id: string;
	name: string;
	summary: string | null;
	store_listing_id: string;
	styles: Record<string, unknown>;
	hero_ranking?: number;
	products: CollectibleProduct[];
	hero_banner_url?: string;
	catalog_banner_url?: string;
	featured_block_url?: string;
	logo_url?: string;
	pdp_bg_url?: string;
	mobile_banner_url?: string;
	mobile_bg_url?: string;
}

export type CollectibleCategoryType = 0 | 1 | 2;

export interface CollectibleCategoryGroup {
	type: CollectibleCategoryType;
	label: string;
	products: CollectibleProduct[];
}
