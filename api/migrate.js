import { copy } from "@vercel/blob";
import {
  param,
  newId,
  photoPrefix,
  boardPath,
  legacyBoardPath,
  spacePath,
  readJson,
  writeJson,
  spaceHash,
  cleanCells,
  reply,
  preflight,
} from "./_board.js";
import { loadSpace } from "./space.js";

export const OPTIONS = preflight;

/** Copies a photo into another board's folder and returns the new path. */
async function copyPhoto(path, toBoard) {
  const name = path.split("/").pop();
  const result = await copy(path, `${photoPrefix(toBoard)}${name}`, {
    access: "private",
    addRandomSuffix: true,
  });
  return result.pathname;
}

/**
 * Splits an old multi-tab board into one board per tab and adds them to the space.
 * The first tab keeps the old id so old links still open it. Safe to call twice.
 * Returns the space like GET /api/space.
 */
export async function POST(request) {
  const id = param(request, "id");
  const spaceId = param(request, "space");
  if (!id || !spaceId) return reply({ error: "Bad id" }, 400);

  const legacy = await readJson(legacyBoardPath(id));
  if (!legacy) return reply({ error: "Not found" }, 404);

  let ids = legacy.migratedTo;
  if (!ids) {
    ids = [];
    for (const [name, tab] of Object.entries(legacy.years ?? {})) {
      const boardId = ids.length === 0 ? id : newId();
      const cells = [...tab.cells];
      if (boardId !== id) {
        for (const [i, cell] of cells.entries()) {
          if (cell?.photo) cells[i] = { ...cell, photo: await copyPhoto(cell.photo, boardId) };
        }
      }
      await writeJson(boardPath(boardId), {
        name,
        creator: spaceHash(spaceId),
        cells: cleanCells(boardId, cells),
      });
      ids.push(boardId);
    }
    await writeJson(legacyBoardPath(id), { ...legacy, migratedTo: ids });
  }

  const space = (await readJson(spacePath(spaceId))) ?? { boards: [] };
  for (const boardId of ids) if (!space.boards.includes(boardId)) space.boards.push(boardId);
  await writeJson(spacePath(spaceId), space);
  return reply(await loadSpace(spaceId));
}
