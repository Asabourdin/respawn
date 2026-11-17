/** Tiny Web-standard response helpers shared by every handler (Node, Vercel, Deno). */

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  })
}

export function errorJson(
  status: number,
  error: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return json({ error, ...extra }, status, headers)
}

/** Reads a request body as text, refusing anything over `maxBytes` (413). */
export async function readTextCapped(
  req: Request,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string }> {
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, status: 413, error: 'body too large' }
  if (!req.body) return { ok: true, text: '' }
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined)
      return { ok: false, status: 413, error: 'body too large' }
    }
    chunks.push(value)
  }
  const buf = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    buf.set(c, offset)
    offset += c.byteLength
  }
  return { ok: true, text: new TextDecoder().decode(buf) }
}
