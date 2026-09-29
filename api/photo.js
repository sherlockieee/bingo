import { get, put } from "@vercel/blob";
import { boardIdFrom, photoPrefix, withCors, preflight } from "./_board.js";

const MAX_BYTES = 4 * 1024 * 1024;

export const OPTIONS = preflight;

export async function GET(request) {
  const id = boardIdFrom(request);
  const path = new URL(request.url).searchParams.get("path");
  if (!id || !path || !path.startsWith(photoPrefix(id))) {
    return new Response("Not found", { status: 404 });
  }
  const result = await get(path, { access: "private" });
  if (!result) return new Response("Not found", { status: 404 });
  return new Response(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

/** Stores a JPEG body and returns its `{ path }` for use as a cell's photo. */
export async function POST(request) {
  const id = boardIdFrom(request);
  if (!id) return withCors(Response.json({ error: "Bad board id" }, { status: 400 }));
  if (request.headers.get("content-type") !== "image/jpeg") {
    return withCors(Response.json({ error: "Expected image/jpeg" }, { status: 415 }));
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return withCors(Response.json({ error: "Photo too large" }, { status: 413 }));
  }
  const blob = await put(`${photoPrefix(id)}photo.jpg`, bytes, {
    access: "private",
    contentType: "image/jpeg",
    addRandomSuffix: true,
  });
  return withCors(Response.json({ path: blob.pathname }));
}
