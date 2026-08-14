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
    // Profile Frame items include a `layers` array where each layer has an `id`.
    // This field is optional because it is only present for category type 3.
    layers?: Array<{ id: string }>;
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

// Added support for Profile Frame category (type 3)
export type CollectibleCategoryType = 0 | 1 | 2 | 3;

export interface CollectibleCategoryGroup {
	type: CollectibleCategoryType;
	label: string;
	products: CollectibleProduct[];
}
