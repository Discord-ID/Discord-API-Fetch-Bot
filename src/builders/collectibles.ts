import { CollectibleCategoryGroup, CollectibleCategoryType, CollectibleProduct, CollectibleRelease } from '../types/collectible';

type DiscordComponent = Record<string, unknown>;
const MAX_PRODUCTS_PER_DETAIL_MESSAGE = 10;

const CATEGORY_LABELS: Record<CollectibleCategoryType, string> = {
  0: 'Avatar Decoration',
  1: 'Profile Effect',
  2: 'Nameplate Decoration',
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

function readImageFromProduct(product: CollectibleProduct, releaseBannerUrl: string): string {
  const firstItem = product.items[0];
  const candidates = [
    firstItem?.thumbnailPreviewSrc,
    product.preview_assets[0]?.url,
    firstItem?.assets?.static_image_url,
    firstItem?.assets?.animated_image_url,
    releaseBannerUrl,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

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

function buildProductSection(product: CollectibleProduct, categoryType: CollectibleCategoryType): DiscordComponent {
  return buildProductSectionWithBanner(product, categoryType, '');
}

function buildProductSectionWithBanner(product: CollectibleProduct, categoryType: CollectibleCategoryType, releaseBannerUrl: string): DiscordComponent {
  const imageUrl = readImageFromProduct(product, releaseBannerUrl);
  const priceLine = formatPriceLine(product);

  return {
    type: 9,
    accessory: {
      type: 11,
      media: {
        url: imageUrl,
      },
      description: null,
      spoiler: false,
    },
    components: [
      {
        type: 10,
        content: `[**${product.name}**](<https://discord.com/shop#itemSkuId=${product.sku_id}>) (\`${product.sku_id}\`) \`►\`\n> Price: ${priceLine}\n> ${categoryLabel(categoryType)} ID: \`${categoryType}\``,
      },
    ],
  };
}

function canRenderProduct(product: CollectibleProduct): boolean {
  return canRenderProductWithBanner(product, '');
}

function canRenderProductWithBanner(product: CollectibleProduct, releaseBannerUrl: string): boolean {
  try {
    readImageFromProduct(product, releaseBannerUrl);
    formatPriceLine(product);
    return true;
  } catch {
    return false;
  }
}

function groupReleaseProducts(release: CollectibleRelease): CollectibleCategoryGroup[] {
  const categoryTypes: CollectibleCategoryType[] = [0, 1, 2];
  const bannerUrl = readImageFromReleaseIfPresent(release);

  return categoryTypes
    .map((type) => ({
      type,
      label: categoryLabel(type),
      products: release.products.filter((product) => product.type === type && canRenderProductWithBanner(product, bannerUrl)),
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

export function buildCollectibleDetailPayloads(release: CollectibleRelease, categoryType: CollectibleCategoryType): Array<{
  content?: string;
  flags: number;
  components: DiscordComponent[];
}> {
  const bannerUrl = readImageFromRelease(release);
  const categoryProducts = release.products.filter((product) => product.type === categoryType && canRenderProductWithBanner(product, bannerUrl));

  if (categoryProducts.length === 0) {
    throw new Error(`Collectible ${release.sku_id} does not contain products for category ${categoryLabel(categoryType)}`);
  }

  const payloads: Array<{
    content?: string;
    flags: number;
    components: DiscordComponent[];
  }> = [];

  for (let index = 0; index < categoryProducts.length; index += MAX_PRODUCTS_PER_DETAIL_MESSAGE) {
    const chunk = categoryProducts.slice(index, index + MAX_PRODUCTS_PER_DETAIL_MESSAGE);
    const isFirstChunk = index === 0;
    const isLastChunk = index + MAX_PRODUCTS_PER_DETAIL_MESSAGE >= categoryProducts.length;
    const chunkComponents: DiscordComponent[] = [];

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

    chunkComponents.push(...chunk.map((product) => buildProductSectionWithBanner(product, categoryType, bannerUrl)));

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

    payloads.push({
      content: undefined,
      flags: 32768,
      components: [
        buildContainer(chunkComponents),
      ],
    });
  }

  return payloads;
}
