const FONT_URL =
  "https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSans/full/ttf/NotoSans-Regular.ttf";

const LOCAL_FONTS = [
  "C:/Windows/Fonts/arial.ttf",
  "C:/Windows/Fonts/tahoma.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
];

let pending: Promise<Uint8Array> | null = null;

export function loadCyrillicFontBytes(): Promise<Uint8Array> {
  if (pending === null) {
    pending = readLocalFont().then((local) => local ?? fetchRemoteFont());
  }
  return pending;
}

async function readLocalFont(): Promise<Uint8Array | null> {
  if (typeof process === "undefined" || process.versions?.node === undefined) {
    return null;
  }

  try {
    const { existsSync, readFileSync } = await import("node:fs");
    for (const path of LOCAL_FONTS) {
      if (existsSync(/* turbopackIgnore: true */ path)) {
        return new Uint8Array(readFileSync(/* turbopackIgnore: true */ path));
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchRemoteFont(): Promise<Uint8Array> {
  const response = await fetch(FONT_URL);
  if (!response.ok) {
    throw new Error("Не удалось загрузить шрифт для PDF");
  }
  return new Uint8Array(await response.arrayBuffer());
}
