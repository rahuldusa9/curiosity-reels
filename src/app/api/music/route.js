import path from "node:path";
import { readdir } from "node:fs/promises";

export const runtime = "nodejs";

const SUPPORTED_AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".wav", ".ogg", ".aac"]);

function makeTitleFromFilename(filename) {
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  return withoutExt
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET() {
  try {
    const audioDir = path.join(process.cwd(), "public", "audio");
    const files = await readdir(audioDir, { withFileTypes: true });

    const tracks = files
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => SUPPORTED_AUDIO_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .map((name, index) => ({
        id: `local-track-${index + 1}`,
        title: makeTitleFromFilename(name),
        artist: "Local Library",
        src: `/audio/${encodeURIComponent(name)}`,
      }));

    return Response.json({ tracks, count: tracks.length });
  } catch {
    return Response.json({ tracks: [], count: 0 });
  }
}
