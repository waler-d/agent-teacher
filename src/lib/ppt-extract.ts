import JSZip from "jszip";

const MAX_PPT_CHARS = 12000;

/** 从 .pptx 缓冲中提取按页整理的文本 */
export async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/\d+/)?.[0] ?? 0);
      const nb = Number(b.match(/\d+/)?.[0] ?? 0);
      return na - nb;
    });

  const pages: string[] = [];
  for (const name of slideNames) {
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async("text");
    const chunks =
      xml.match(/<a:t(?:[^>]*)>([^<]*)<\/a:t>/g)?.map((tag) =>
        tag.replace(/<[^>]+>/g, "").trim(),
      ) ?? [];
    const text = chunks.filter(Boolean).join(" ").trim();
    if (text) pages.push(`[第${pages.length + 1}页] ${text}`);
  }

  return pages.join("\n");
}

export function truncatePptText(text: string, max = MAX_PPT_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…（正文过长已截断，可分批指定页码继续入库）`;
}

export function isPptxFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".pptx");
}

export function isLegacyPptFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".ppt") && !lower.endsWith(".pptx");
}
