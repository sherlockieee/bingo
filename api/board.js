import {
  isId,
  param,
  cleanName,
  cleanCell,
  cleanCells,
  boardPath,
  legacyBoardPath,
  readJson,
  writeJson,
  spaceHash,
  publicBoard,
  deleteDroppedPhotos,
  deleteBoard,
  GRID_SIZE,
  reply,
  preflight,
} from "./_board.js";

export const OPTIONS = preflight;

/** Returns the board, or 404 with `legacy: true` if it only exists in the old multi-tab format. */
export async function GET(request) {
  const id = param(request, "id");
  if (!id) return reply({ error: "Bad board id" }, 400);
  const board = await readJson(boardPath(id));
  if (board) return reply(publicBoard(id, board, param(request, "space")));
  const legacy = await readJson(legacyBoardPath(id));
  return reply({ error: "Not found", legacy: !!legacy }, 404);
}

/**
 * Body, one of:
 *   { create: { name }, space }       makes an empty board owned by `space`
 *   { cells: { [index]: cell } }      merges the given tiles
 *   { cells: [...], replace: true }   replaces every tile
 *   { delete: true, space }           deletes the board, only for its creator
 * Returns the board after the write.
 */
export async function POST(request) {
  const id = param(request, "id");
  if (!id) return reply({ error: "Bad board id" }, 400);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || "year" in body) {
    return reply({ error: "Bad body — reload the page" }, 400);
  }

  const existing = await readJson(boardPath(id));

  if (body.create) {
    const name = cleanName(body.create.name);
    if (existing) return reply({ error: "Board exists" }, 409);
    if (!name || !isId(body.space)) {
      return reply({ error: "Bad name or space" }, 400);
    }
    const board = { name, creator: spaceHash(body.space), cells: cleanCells(id, body.create.cells) };
    await writeJson(boardPath(id), board);
    return reply(publicBoard(id, board, body.space));
  }

  if (!existing) return reply({ error: "Not found" }, 404);

  if (body.delete === true) {
    if (!isId(body.space) || existing.creator !== spaceHash(body.space)) {
      return reply({ error: "Only the board's creator can delete it" }, 403);
    }
    await deleteBoard(id);
    return reply({ deleted: true });
  }

  if (!body.cells || typeof body.cells !== "object") return reply({ error: "Bad body" }, 400);
  const before = existing.cells;
  let after;
  if (body.replace === true) {
    after = cleanCells(id, body.cells);
  } else {
    after = [...before];
    for (const [key, cell] of Object.entries(body.cells)) {
      const i = Number(key);
      if (Number.isInteger(i) && i >= 0 && i < GRID_SIZE) after[i] = cleanCell(id, cell);
    }
  }
  const board = { ...existing, cells: after };
  await writeJson(boardPath(id), board);
  await deleteDroppedPhotos(before, after);
  return reply(publicBoard(id, board, body.space));
}
