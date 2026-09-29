import { get, put, del, list } from "@vercel/blob";
import { createHash, randomBytes } from "node:crypto";

export const GRID_SIZE = 25;
const ID = /^[A-Za-z0-9_-]{16,64}$/;
const MAX_NAME = 40;

export const isId = (id) => typeof id === "string" && ID.test(id);
export const newId = () => randomBytes(16).toString("base64url");

export function param(request, name) {
  const value = new URL(request.url).searchParams.get(name);
  return isId(value) ? value : null;
}

export const cleanName = (name) =>
  typeof name === "string" && name.trim() ? name.trim().slice(0, MAX_NAME) : null;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://sherlockieee.github.io",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

/** Returns a JSON response with no-store and CORS headers for the GitHub Pages site. */
export function reply(data, status = 200) {
  const response = Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
  for (const [k, v] of Object.entries(CORS_HEADERS)) response.headers.set(k, v);
  return response;
}

export const preflight = () => {
  const response = new Response(null, { status: 204 });
  for (const [k, v] of Object.entries(CORS_HEADERS)) response.headers.set(k, v);
  return response;
};

export const photoPrefix = (id) => `boards/${id}/photos/`;
export const boardPath = (id) => `boards/${id}/v2.json`;
export const legacyBoardPath = (id) => `boards/${id}/board.json`;
export const spacePath = (id) => `spaces/${id}.json`;

/** Returns the parsed JSON at `path`, or null if it doesn't exist. */
export async function readJson(path) {
  const result = await get(path, { access: "private", useCache: false });
  return result ? new Response(result.stream).json() : null;
}

export async function writeJson(path, data) {
  await put(path, JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

/** Returns a one-way hash of a space id, stored on boards so the id itself never leaks. */
export const spaceHash = (spaceId) => createHash("sha256").update(spaceId).digest("hex");

/** Returns a clean cell, keeping only photos that belong to this board. */
export function cleanCell(id, cell) {
  const c = cell && typeof cell === "object" ? cell : {};
  const text = typeof c.text === "string" ? c.text.slice(0, 80) : "";
  const note = typeof c.note === "string" ? c.note.slice(0, 1000) : "";
  const photo =
    typeof c.photo === "string" && c.photo.startsWith(photoPrefix(id)) ? c.photo : null;
  return { text, done: c.done === true, note, photo };
}

export function cleanCells(id, cells) {
  const source = Array.isArray(cells) ? cells : [];
  return Array.from({ length: GRID_SIZE }, (_, i) => cleanCell(id, source[i]));
}

/** Returns what clients may see of a board: never the creator hash itself. */
export const publicBoard = (id, board, spaceId) => ({
  id,
  name: board.name,
  cells: board.cells,
  mine: spaceId ? board.creator === spaceHash(spaceId) : false,
});

/** Deletes photos that were on `before` cells but are no longer on `after` cells. */
export async function deleteDroppedPhotos(before, after) {
  const kept = new Set(after.map((c) => c && c.photo).filter(Boolean));
  const dropped = before.map((c) => c && c.photo).filter((p) => p && !kept.has(p));
  if (dropped.length) await del(dropped);
}

/** Deletes a board's grid and every photo it holds. */
export async function deleteBoard(id) {
  const { blobs } = await list({ prefix: photoPrefix(id) });
  await del([boardPath(id), ...blobs.map((b) => b.url)]);
}
