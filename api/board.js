import {
  GRID_SIZE,
  boardIdFrom,
  isTabName,
  readBoard,
  writeBoard,
  cleanCell,
  deleteDroppedPhotos,
  withCors,
  preflight,
} from "./_board.js";

const NO_STORE = { "Cache-Control": "no-store" };

export const OPTIONS = preflight;

export async function GET(request) {
  const id = boardIdFrom(request);
  if (!id) return withCors(Response.json({ error: "Bad board id" }, { status: 400 }));
  return withCors(Response.json(await readBoard(id), { headers: NO_STORE }));
}

/**
 * Body: { year, cells: { [index]: cell } } merges the given cells into that tab.
 * With `replace: true`, `cells` must be a full array and replaces the tab.
 * With `remove: true`, deletes the tab and its photos.
 * Returns the whole board after the write.
 */
export async function POST(request) {
  const id = boardIdFrom(request);
  if (!id) return withCors(Response.json({ error: "Bad board id" }, { status: 400 }));

  const body = await request.json().catch(() => null);
  const hasCells = body?.cells && typeof body.cells === "object";
  if (!body || !isTabName(body.year) || (!hasCells && body.remove !== true)) {
    return withCors(Response.json({ error: "Bad body" }, { status: 400 }));
  }

  const board = await readBoard(id);
  const before = Object.hasOwn(board.years, body.year) ? board.years[body.year].cells : [];

  if (body.remove === true) {
    delete board.years[body.year];
    await writeBoard(id, board);
    await deleteDroppedPhotos(before, []);
    return withCors(Response.json(board, { headers: NO_STORE }));
  }
  const after = body.replace ? [] : [...before];
  if (!body.replace) after.length = GRID_SIZE;

  for (const [key, cell] of Object.entries(body.cells)) {
    const i = Number(key);
    if (!Number.isInteger(i) || i < 0 || i >= GRID_SIZE) continue;
    after[i] = cleanCell(id, cell);
  }
  const cells = Array.from({ length: GRID_SIZE }, (_, i) => after[i] ?? cleanCell(id, {}));

  board.years[body.year] = { cells };
  await writeBoard(id, board);
  await deleteDroppedPhotos(before, cells);
  return withCors(Response.json(board, { headers: NO_STORE }));
}
