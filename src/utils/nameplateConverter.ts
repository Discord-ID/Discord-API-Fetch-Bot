import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

interface ConversionResult {
  pngBuffer: Buffer;
  fileName: string;
  cleanup: () => Promise<void>;
}

/**
 * Downloads a nameplate .webm from Discord CDN and converts the first frame to PNG.
 * Returns a buffer and cleanup function for temp files.
 */
export async function downloadAndConvertNameplate(
  skuId: string,
  asset: string
): Promise<ConversionResult> {
  // Build .webm URL (same logic as builder)
  const cleanAsset = asset.replace('nameplates/nameplates/', 'nameplates/');
  const webmUrl = `https://cdn.discordapp.com/assets/collectibles/${cleanAsset}asset.webm`;

  // Create temp directory for this conversion
  const tempDir = join(tmpdir(), `discord-nameplate-${skuId}-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  const webmPath = join(tempDir, `${skuId}.webm`);
  const pngPath = join(tempDir, `${skuId}.png`);

  try {
    // Download .webm
    const response = await fetch(webmUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${webmUrl}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    await writeFile(webmPath, Buffer.from(arrayBuffer));

    // Extract first frame using ffmpeg
    await extractFirstFrame(webmPath, pngPath);

    // Read the generated PNG
    const pngBuffer = await readFile(pngPath);
    console.log(`[DEBUG] Converted nameplate ${skuId} to PNG, size: ${pngBuffer.length} bytes`);

    const fileName = `nameplate-${skuId}.png`;

    // Cleanup function
    const cleanup = async () => {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    };

    return { pngBuffer, fileName, cleanup };
  } catch (error) {
    // Cleanup on error
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
    throw error;
  }
}

function extractFirstFrame(webmPath: string, pngPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath.path, ['-y', '-i', webmPath, '-vframes', '1', '-update', '1', pngPath]);
    let stderr = '';
    ffmpeg.stderr.on('data', (data) => (stderr += data.toString()));
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
    });
    ffmpeg.on('error', (err) => reject(new Error(`Failed to spawn ffmpeg: ${err.message}`)));
  });
}