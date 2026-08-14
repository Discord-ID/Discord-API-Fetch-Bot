import { CollectibleCategoryGroup, CollectibleCategoryType, CollectibleProduct, CollectibleRelease } from '../types/collectible';
import { downloadAndConvertNameplate } from '../utils/nameplateConverter';

type DiscordComponent = Record<string, unknown>;
const MAX_PRODUCTS_PER_DETAIL_MESSAGE = 10;

// Added label for the new Profile Frame category (type 3)
const CATEGORY_LABELS: Record<CollectibleCategoryType, string> = {
  0: 'Avatar Decoration',
  1: 'Profile Effect',
  2: 'Nameplate Decoration',
  3: 'Profile Frame',
};

function formatUsd(amount: number, exponent: number): string {
  return `$${(amount / 10 ** exponent).toFixed(exponent)}`;
}

function formatCurrency(amount: number, currency: string, exponent: number): string {
  if (currency === 'usd') {
    return formatUsd(amount, exponent);
  }

  if (currency === 'discord_orb') {
    return `${amount} Orbs`;
  }

  return `${amount} ${currency.toUpperCase()}`;
}

function readImageFromRelease(release: CollectibleRelease): string {
  if (typeof release.featured_block_url === 'string' && release.featured_block_url.length > 0) {
    return release.featured_block_url;
  }

  const candidates = [
    release.catalog_banner_url,
    release.hero_banner_url,
    release.mobile_banner_url,
    release.mobile_bg_url,
    release.logo_url,
    release.pdp_bg_url,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  throw new Error(`Collectible ${release.sku_id} does not contain a usable banner image`);
}

function readImageFromReleaseIfPresent(release: CollectibleRelease): string {
  try {
    return readImageFromRelease(release);
  } catch {
    return '';
  }
}

/**
 * Returns the best image URL for a product.
 *
 * For regular categories (0â€‘2) we **do not** fall back to the release banner â€“
 * this prevents the bug where every product displayed the same banner image.
 * For the new Profile Frame category (type 3)
 */
function readImageFromProduct(
  product: CollectibleProduct,
  releaseBannerUrl: string,
  isFrame: boolean = false,
): string {
  const firstItem = product.items[0];
  // Include various possible image sources. Avatar and Frame items often store the
  // image URL directly in `asset`. The previous implementation omitted this field,
  // causing those categories to be filtered out because no image was found.
  // Build a list of possible image URLs. For avatars (typeâ€¯0) the `asset` field contains only the
  // filename; we must construct the full CDN URL. For profile frames (typeâ€¯3) we can build a static
  // image URL from the first layer ID. Other categories fall back to the existing candidates.
  const candidates: (string | undefined)[] = [];

  // Avatar (typeâ€¯0) â€“ construct full CDN URL if `asset` is present.
  if (!isFrame && product.type === 0 && typeof firstItem?.asset === 'string' && firstItem.asset.length > 0) {
    candidates.push(`https://cdn.discordapp.com/avatar-decoration-presets/${firstItem.asset}.png?size=4096&passthrough=true`);
  }

  // Profile Frame (typeâ€¯3) â€“ build static image URL from the first layer ID if available.
  // The API may include a `layers` array on the item, but the type definition does not
  // currently expose it. We safely access it via a cast to `any` to avoid TypeScript errors.
  if (isFrame) {
    const layers = (firstItem as any)?.layers as Array<{ id: string }> | undefined;
    if (Array.isArray(layers) && layers.length > 0) {
      const layerId = layers[0].id;
      if (typeof layerId === 'string' && layerId.length > 0) {
        candidates.push(`https://cdn.discordapp.com/media/v1/collectibles-shop/${product.sku_id}/${layerId}/static`);
      }
    }
  }

  // Fallback candidates that may already contain a full URL.
  candidates.push(
    firstItem?.thumbnailPreviewSrc,
    firstItem?.asset,
    product.preview_assets[0]?.url,
    firstItem?.assets?.static_image_url,
    firstItem?.assets?.animated_image_url,
  );

  // Nameplate (typeâ€¯2) â€“ construct CDN URL for the new .webm style.
  // Example asset: "nameplates/nature's_glitter/1531412184054104104/"
  // The correct CDN URL is:
  //   https://cdn.discordapp.com/assets/collectibles/<asset>asset.webm
  // where <asset> already includes the trailing slash.
  if (!isFrame && product.type === 2 && typeof firstItem?.asset === 'string' && firstItem.asset.length > 0) {
    // The asset string may contain a duplicated "nameplates/nameplates/" segment.
    // Replace the duplicate with a single occurrence to form the correct CDN path.
    const cleanAsset = firstItem.asset.replace('nameplates/nameplates/', 'nameplates/');
    if (cleanAsset) {
      candidates.push(`https://cdn.discordapp.com/assets/collectibles/${cleanAsset}asset.webm`);
    }
  }


  // Helper to ensure the URL is wellâ€‘formed for Discord (must start with http/https)
  const isValidUrl = (url: string | undefined): boolean =>
    typeof url === 'string' && url.length > 0 && /^(https?:)\/\//i.test(url);

  for (const candidate of candidates) {
    if (isValidUrl(candidate)) {
      return candidate as string;
    }
  }

  // No valid image URL found; do not fall back to release banner as per requirements.
  throw new Error(`Product ${product.sku_id} does not contain a usable image`);
}

function categoryLabel(type: CollectibleCategoryType): string {
  return CATEGORY_LABELS[type];
}

function categoryTitle(type: CollectibleCategoryType, release: CollectibleRelease): string {
  return `# ${categoryLabel(type)} - ${release.name}`;
}

function starterTitle(release: CollectibleRelease): string {
  return `# Collectibles Release - ${release.name}`;
}

function buildStarterFooter(mention: string): string {
  return `-# Source by Discord ID API | \`discord.my.id\`\n-# ${mention}`;
}

function buildDetailFooter(release: CollectibleRelease): string {
  return `Category SKU ID: ${release.sku_id}`;
}

function buildContainer(components: DiscordComponent[]): DiscordComponent {
  return {
    type: 17,
    accent_color: null,
    spoiler: false,
    components,
  };
}

function formatPriceLine(product: CollectibleProduct): string {
  const regularTier = product.prices['0'];
  const nitroTier = product.prices['4'];

  if (!regularTier) {
    throw new Error(`Product ${product.sku_id} does not contain regular tier prices`);
  }

  const regularUsd = regularTier.country_prices.prices.find((price) => price.currency === 'usd');
  const orbPrice = regularTier.country_prices.prices.find((price) => price.currency === 'discord_orb');

  if (!regularUsd) {
    throw new Error(`Product ${product.sku_id} does not contain regular USD price`);
  }

  const parts: string[] = [
    `${formatCurrency(regularUsd.amount, regularUsd.currency, regularUsd.exponent)} Regular`,
  ];

  if (nitroTier) {
    const nitroUsd = nitroTier.country_prices.prices.find((price) => price.currency === 'usd');

    if (nitroUsd) {
      parts.push(`${formatCurrency(nitroUsd.amount, nitroUsd.currency, nitroUsd.exponent)} Nitro`);
    }
  }

  if (orbPrice) {
    parts.push(formatCurrency(orbPrice.amount, orbPrice.currency, orbPrice.exponent));
  }

  return parts.join(', ');
}

interface ProductSectionResult {
  component: DiscordComponent;
  // Optional file attachment for nameplate PNG thumbnails
  // Can be either a file path (for static assets) or a buffer (for on-the-fly generated PNGs)
  file?: { name: string; filePath?: string; buffer?: Buffer };
}

async function buildProductSection(product: CollectibleProduct, categoryType: CollectibleCategoryType): Promise<ProductSectionResult> {
  return buildProductSectionWithBanner(product, categoryType, '');
}

async function buildProductSectionWithBanner(product: CollectibleProduct, categoryType: CollectibleCategoryType, releaseBannerUrl: string): Promise<ProductSectionResult> {
  const isFrame = categoryType === 3;
  const priceLine = formatPriceLine(product);

  // Check if this is a nameplate - use on-the-fly conversion
  let fileAttachment: ProductSectionResult['file'] = undefined;
  let finalImageUrl: string;

  if (!isFrame && categoryType === 2 && typeof product.items[0]?.asset === 'string') {
    const asset = product.items[0].asset;
    try {
      const { pngBuffer, fileName, cleanup } = await downloadAndConvertNameplate(product.sku_id, asset);
      fileAttachment = { name: fileName, buffer: pngBuffer };
      // Store cleanup function to call after upload
      (fileAttachment as any).cleanup = cleanup;
      // Use attachment:// URL since we successfully converted and will upload the PNG
      finalImageUrl = `attachment://${fileName}`;
    } catch (error) {
      console.error(`Failed to convert nameplate ${product.sku_id}:`, error);
      // Fall back to .webm URL for the embed
      const cleanAsset = asset.replace('nameplates/nameplates/', 'nameplates/');
      finalImageUrl = `https://cdn.discordapp.com/assets/collectibles/${cleanAsset}asset.webm`;
    }
  } else {
    // For non-nameplate products, use the standard image URL resolution
    finalImageUrl = readImageFromProduct(product, releaseBannerUrl, isFrame);
  }

  console.log(`[DEBUG] Product ${product.sku_id} (type ${categoryType}): finalImageUrl = ${finalImageUrl}, fileAttachment = ${fileAttachment ? `${fileAttachment.name} (${fileAttachment.buffer?.length || 0} bytes)` : 'none'}`);

  return {
    component: {
      type: 9,
      accessory: {
        type: 11,
        media: {
          url: finalImageUrl,
        },
        description: null,
        spoiler: false,
      },
      components: [
        {
          type: 10,
          content: `[**${product.name}**](<https://discord.com/shop#itemSkuId=${product.sku_id}>) (\`${product.sku_id}\`) \`��\`\n> Price: ${priceLine}\n> ${categoryLabel(categoryType)} ID: \`${categoryType}\``,
        },
      ],
    },
    file: fileAttachment,
  };
}

function canRenderProduct(product: CollectibleProduct, categoryType: CollectibleCategoryType): boolean {
  return canRenderProductWithBanner(product, '', categoryType);
}

function canRenderProductWithBanner(product: CollectibleProduct, releaseBannerUrl: string, categoryType: CollectibleCategoryType): boolean {
  try {
    const isFrame = categoryType === 3;
    readImageFromProduct(product, releaseBannerUrl, isFrame);
    formatPriceLine(product);
    return true;
  } catch {
    return false;
  }
}

function groupReleaseProducts(release: CollectibleRelease): CollectibleCategoryGroup[] {
  const categoryTypes: CollectibleCategoryType[] = [0, 1, 2, 3];
  const bannerUrl = readImageFromReleaseIfPresent(release);

  return categoryTypes
    .map((type) => ({
      type,
      label: categoryLabel(type),
      products: release.products.filter((product) => product.type === type && canRenderProductWithBanner(product, bannerUrl, type)),
    }))
    .filter((group) => group.products.length > 0);
}

export function buildThreadName(release: CollectibleRelease): string {
  return `Collectibles - ${release.name}`;
}

export function groupCollectibleCategories(release: CollectibleRelease): CollectibleCategoryGroup[] {
  return groupReleaseProducts(release);
}

export function buildCollectibleStarterPayload(release: CollectibleRelease, mention: string): {
  content?: string;
  flags: number;
  components: DiscordComponent[];
} {
  const bannerUrl = readImageFromRelease(release);

  return {
    content: undefined,
    flags: 32768,
    components: [
      buildContainer([
        {
          type: 10,
          content: starterTitle(release),
        },
        {
          type: 12,
          items: [
            {
              media: {
                url: bannerUrl,
              },
              description: null,
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
          content: buildStarterFooter(mention),
        },
      ]),
    ],
  };
}

export async function buildCollectibleDetailPayloads(release: CollectibleRelease, categoryType: CollectibleCategoryType): Promise<Array<{
  content?: string;
  flags: number;
  components: DiscordComponent[];
  files?: Array<{ name: string; filePath?: string; buffer?: Buffer; cleanup?: () => Promise<void> }>;
}>> {
  const bannerUrl = readImageFromRelease(release);
  const categoryProducts = release.products.filter((product) => product.type === categoryType && canRenderProductWithBanner(product, bannerUrl, categoryType));

  if (categoryProducts.length === 0) {
    throw new Error(`Collectible ${release.sku_id} does not contain products for category ${categoryLabel(categoryType)}`);
  }

  const payloads: Array<{
    content?: string;
    flags: number;
    components: DiscordComponent[];
    files?: Array<{ name: string; filePath?: string; buffer?: Buffer; cleanup?: () => Promise<void> }>;
  }> = [];

  for (let index = 0; index < categoryProducts.length; index += MAX_PRODUCTS_PER_DETAIL_MESSAGE) {
    const chunk = categoryProducts.slice(index, index + MAX_PRODUCTS_PER_DETAIL_MESSAGE);
    const isFirstChunk = index === 0;
    const isLastChunk = index + MAX_PRODUCTS_PER_DETAIL_MESSAGE >= categoryProducts.length;
    const chunkComponents: DiscordComponent[] = [];
    const chunkFiles: Array<{ name: string; filePath?: string; buffer?: Buffer; cleanup?: () => Promise<void> }> = [];

    if (isFirstChunk) {
      chunkComponents.push(
        {
          type: 10,
          content: categoryTitle(categoryType, release),
        },
        {
          type: 12,
          items: [
            {
              media: {
                url: bannerUrl,
              },
              description: null,
              spoiler: false,
            },
          ],
        },
        {
          type: 14,
          divider: true,
          spacing: 1,
        },
      );
    }

    for (const product of chunk) {
      const result = await buildProductSectionWithBanner(product, categoryType, bannerUrl);
      chunkComponents.push(result.component);
      if (result.file) {
        chunkFiles.push(result.file);
      }
    }

    if (isLastChunk) {
      chunkComponents.push(
        {
          type: 14,
          divider: true,
          spacing: 1,
        },
        {
          type: 10,
          content: buildDetailFooter(release),
        },
      );
    }

    const payload: {
      content?: string;
      flags: number;
      components: DiscordComponent[];
      files?: Array<{ name: string; filePath?: string; buffer?: Buffer; cleanup?: () => Promise<void> }>;
    } = {
      content: undefined,
      flags: 32768,
      components: [
        buildContainer(chunkComponents),
      ],
    };

    if (chunkFiles.length > 0) {
      payload.files = chunkFiles;
    }

    payloads.push(payload);
  }

  return payloads;
}

