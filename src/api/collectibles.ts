import { fetchJson } from '../utils/fetcher';
import { CollectibleRelease } from '../types/collectible';

const COLLECTIBLES_ENDPOINT = 'https://api.discordquest.com/api/collectibles';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function readString(value: unknown, fieldName: string): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`Missing required field: ${fieldName}`);
	}

	return value.trim();
}

function readNullableString(value: unknown, fieldName: string): string | null {
	if (value === null) {
		return null;
	}

	if (typeof value !== 'string') {
		throw new Error(`Missing required field: ${fieldName}`);
	}

	return value;
}

function readOptionalNullableString(value: unknown): string | null | undefined {
	if (typeof value === 'undefined') {
		return undefined;
	}

	if (value === null) {
		return null;
	}

	if (typeof value !== 'string') {
		return undefined;
	}

	return value;
}

function readNumber(value: unknown, fieldName: string): number {
	if (typeof value !== 'number' || Number.isNaN(value)) {
		throw new Error(`Missing required field: ${fieldName}`);
	}

	return value;
}

function readOptionalNumber(value: unknown): number | undefined {
	if (typeof value !== 'number' || Number.isNaN(value)) {
		return undefined;
	}

	return value;
}

function readOptionalString(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();

	return trimmed.length > 0 ? trimmed : undefined;
}

function readObject(value: unknown, fieldName: string): Record<string, unknown> {
	if (!isRecord(value)) {
		throw new Error(`Missing required field: ${fieldName}`);
	}

	return value;
}

function readOptionalObject(value: unknown): Record<string, unknown> | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	return value;
}

function readStringArray(value: unknown, fieldName: string): string[] {
	if (!Array.isArray(value)) {
		throw new Error(`Missing required field: ${fieldName}`);
	}

	return value.map((entry, index) => readString(entry, `${fieldName}[${index}]`));
}

function readOptionalStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function readImageUrl(release: Record<string, unknown>): string {
	const candidateFields = [
		release.hero_banner_url,
		release.catalog_banner_url,
		release.featured_block_url,
		release.mobile_banner_url,
		release.mobile_bg_url,
		release.logo_url,
		release.pdp_bg_url,
	];

	for (const candidate of candidateFields) {
		const imageUrl = readOptionalString(candidate);

		if (imageUrl) {
			return imageUrl;
		}
	}

	throw new Error(`Missing required image field for collectible ${String(release.sku_id)}`);
}

function normalizeCollectible(item: unknown): CollectibleRelease {
	const record = readObject(item, 'collectible');
	const products = record.products;

	if (!Array.isArray(products) || products.length === 0) {
		throw new Error('Missing required field: products');
	}

	return {
		sku_id: readString(record.sku_id, 'sku_id'),
		name: readString(record.name, 'name'),
		summary: readNullableString(record.summary, 'summary'),
		store_listing_id: readString(record.store_listing_id, 'store_listing_id'),
		styles: readObject(record.styles, 'styles'),
		hero_ranking: readOptionalNumber(record.hero_ranking),
		products: products.map((product, index) => {
			const productRecord = readObject(product, `products[${index}]`);
			const prices = productRecord.prices;
			const previewAssets = productRecord.preview_assets;
			const items = productRecord.items;

			return {
				sku_id: readString(productRecord.sku_id, `products[${index}].sku_id`),
				name: readString(productRecord.name, `products[${index}].name`),
				summary: readNullableString(productRecord.summary, `products[${index}].summary`),
				styles: readObject(productRecord.styles, `products[${index}].styles`),
				prices: isRecord(prices)
					? Object.entries(prices).reduce<Record<string, { country_prices: { country_code: string; prices: Array<{ amount: number; currency: string; exponent: number }> } }>>((acc, [tierKey, tierValue]) => {
						if (!isRecord(tierValue)) {
							return acc;
						}

						const countryPrices = readObject(tierValue.country_prices, `products[${index}].prices.${tierKey}.country_prices`);
						const countryPriceList = countryPrices.prices;

						if (!Array.isArray(countryPriceList) || countryPriceList.length === 0) {
							return acc;
						}

						acc[tierKey] = {
							country_prices: {
								country_code: readString(countryPrices.country_code, `products[${index}].prices.${tierKey}.country_prices.country_code`),
								prices: countryPriceList.map((countryPrice, countryPriceIndex) => {
									const countryPriceRecord = readObject(countryPrice, `products[${index}].prices.${tierKey}.country_prices.prices[${countryPriceIndex}]`);

									return {
										amount: readNumber(countryPriceRecord.amount, `products[${index}].prices.${tierKey}.country_prices.prices[${countryPriceIndex}].amount`),
										currency: readString(countryPriceRecord.currency, `products[${index}].prices.${tierKey}.country_prices.prices[${countryPriceIndex}].currency`),
										exponent: readNumber(countryPriceRecord.exponent, `products[${index}].prices.${tierKey}.country_prices.prices[${countryPriceIndex}].exponent`),
									};
								}),
							},
						};

						return acc;
					}, {})
					: {},
				preview_assets: Array.isArray(previewAssets)
					? previewAssets.map((asset) => {
							const assetRecord = readObject(asset, `products[${index}].preview_assets[]`);

							return {
								url: readOptionalString(assetRecord.url),
							};
						})
					: [],
				items: Array.isArray(items)
					? items.map((entry, itemIndex) => {
					const entryRecord = readObject(entry, `products[${index}].items[${itemIndex}]`);
					const assets = readOptionalObject(entryRecord.assets);

					return {
						type: readNumber(entryRecord.type, `products[${index}].items[${itemIndex}].type`),
						sku_id: readString(entryRecord.sku_id, `products[${index}].items[${itemIndex}].sku_id`),
						asset: readOptionalString(entryRecord.asset),
						assets: assets
							? {
								static_image_url: readOptionalString(assets.static_image_url),
								animated_image_url: readOptionalString(assets.animated_image_url),
							}
							: undefined,
						thumbnailPreviewSrc: readOptionalString(entryRecord.thumbnailPreviewSrc),
						label: readOptionalNullableString(entryRecord.label),
					};
				})
					: [],
				type: readNumber(productRecord.type, `products[${index}].type`),
				premium_type: readNumber(productRecord.premium_type, `products[${index}].premium_type`),
				category_sku_id: readString(productRecord.category_sku_id, `products[${index}].category_sku_id`),
				google_sku_ids: readOptionalStringArray(productRecord.google_sku_ids),
			};
		}),
		hero_banner_url: readOptionalString(record.hero_banner_url),
		catalog_banner_url: readOptionalString(record.catalog_banner_url),
		featured_block_url: readOptionalString(record.featured_block_url),
		logo_url: readOptionalString(record.logo_url),
		pdp_bg_url: readOptionalString(record.pdp_bg_url),
		mobile_banner_url: readOptionalString(record.mobile_banner_url),
		mobile_bg_url: readOptionalString(record.mobile_bg_url),
	};
}

export async function fetchCollectibles(): Promise<CollectibleRelease[]> {
	const payload = await fetchJson<unknown>(COLLECTIBLES_ENDPOINT);

	if (!Array.isArray(payload)) {
		throw new Error('Collectibles API response must be an array');
	}

	const normalized: CollectibleRelease[] = [];

	for (const item of payload) {
		try {
			normalized.push(normalizeCollectible(item));
		} catch {
			continue;
		}
	}

	if (normalized.length === 0) {
		throw new Error('Collectibles API did not return any valid collectible entries');
	}

	return normalized;
}
