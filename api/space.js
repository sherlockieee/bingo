import {
  param,
  isId,
  boardPath,
  spacePath,
  readJson,
  writeJson,
  publicBoard,
  reply,
  preflight,
} from "./_board.js";

export const OPTIONS = preflight;

/** Returns the space's boards in tab order, dropping any that were deleted. */
export async function loadSpace(spaceId) {
  const space = (await readJson(spacePath(spaceId))) ?? { boards: [] };
  const boards = await Promise.all(space.boards.map((id) => readJson(boardPath(id))));
  const alive = space.boards.filter((_, i) => boards[i]);
  if (alive.length !== space.boards.length) {
    await writeJson(spacePath(spaceId), { ...space, boards: alive });
  }
  return {
    boards: space.boards
      .map((id, i) => boards[i] && publicBoard(id, boards[i], spaceId))
      .filter(Boolean),
  };
}

export async function GET(request) {
  const spaceId = param(request, "space");
  if (!spaceId) return reply({ error: "Bad space id" }, 400);
  return reply(await loadSpace(spaceId));
}

/** Body: { add: boardId } or { remove: boardId }. Returns the space like GET. */
export async function POST(request) {
  const spaceId = param(request, "space");
  if (!spaceId) return reply({ error: "Bad space id" }, 400);
  const body = await request.json().catch(() => null);
  const target = body?.add ?? body?.remove;
  if (!isId(target)) return reply({ error: "Bad body" }, 400);

  const space = (await readJson(spacePath(spaceId))) ?? { boards: [] };
  if (body.add) {
    if (!(await readJson(boardPath(target)))) return reply({ error: "Board not found" }, 404);
    if (!space.boards.includes(target)) space.boards.push(target);
  } else {
    space.boards = space.boards.filter((id) => id !== target);
  }
  await writeJson(spacePath(spaceId), space);
  return reply(await loadSpace(spaceId));
}
