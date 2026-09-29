import { get, put, del } from "@vercel/blob";

export const GRID_SIZE = 25;
const BOARD_ID = /^[A-Za-z0-9_-]{16,64}$/;
const MAX_TAB_NAME = 40;
const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function boardIdFrom(request) {
  const id = new URL(request.url).searchParams.get("id");
  return id && BOARD_ID.test(id) ? id : null;
}

export const isTabName = (name) =>
  typeof name === "string" &&
  name.trim() === name &&
  name.length > 0 &&
  name.length <= MAX_TAB_NAME &&
  !RESERVED_KEYS.has(name);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://sherlockieee.github.io",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

/** Returns `response` with CORS headers for the GitHub Pages site added. */
export function withCors(response) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) response.headers.set(k, v);
  return response;
}

export const preflight = () => withCors(new Response(null, { status: 204 }));
export const photoPrefix = (id) => `boards/${id}/photos/`;
const boardPath = (id) => `boards/${id}/board.json`;

export async function readBoard(id) {
  const result = await get(boardPath(id), { access: "private", useCache: false });
  if (!result) return { years: {} };
  return new Response(result.stream).json();
}

export async function writeBoard(id, board) {
  await put(boardPath(id), JSON.stringify(board), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

/** Returns a clean cell, or null if the input isn't a valid cell for this board. */
export function cleanCell(id, cell) {
  if (!cell || typeof cell !== "object") return null;
  const text = typeof cell.text === "string" ? cell.text.slice(0, 80) : "";
  const note = typeof cell.note === "string" ? cell.note.slice(0, 1000) : "";
  const photo =
    typeof cell.photo === "string" && cell.photo.startsWith(photoPrefix(id))
      ? cell.photo
      : null;
  return { text, done: cell.done === true, note, photo };
}

/** Deletes photos that were on `before` cells but are no longer on `after` cells. */
export async function deleteDroppedPhotos(before, after) {
  const kept = new Set(after.map((c) => c && c.photo).filter(Boolean));
  const dropped = before.map((c) => c && c.photo).filter((p) => p && !kept.has(p));
  if (dropped.length) await del(dropped);
}
