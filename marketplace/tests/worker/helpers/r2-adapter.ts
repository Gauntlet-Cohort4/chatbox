/**
 * Minimal in-memory R2Bucket adapter for tests.
 *
 * Implements just the surface we use: put, get, delete, head, list.
 * Returned objects mimic the R2Object / R2ObjectBody shape enough for
 * our route handlers and tests.
 */

interface StoredObject {
  key: string
  body: Uint8Array
  httpMetadata: { contentType?: string }
  customMetadata: Record<string, string>
  uploaded: Date
  etag: string
}

async function computeEtag(body: Uint8Array): Promise<string> {
  // Ensure we pass a concrete ArrayBuffer (not SharedArrayBuffer) to digest
  const buf = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function toUint8Array(input: ArrayBuffer | ArrayBufferView | ReadableStream | string): Promise<Uint8Array> {
  if (typeof input === 'string') {
    return Promise.resolve(new TextEncoder().encode(input))
  }
  if (input instanceof ArrayBuffer) {
    return Promise.resolve(new Uint8Array(input))
  }
  if (ArrayBuffer.isView(input)) {
    return Promise.resolve(new Uint8Array(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength)))
  }
  // ReadableStream — consume it
  return new Response(input).arrayBuffer().then((b) => new Uint8Array(b))
}

export interface FakeR2 {
  put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>
  get(key: string): Promise<FakeR2Object | null>
  head(key: string): Promise<FakeR2Object | null>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string }): Promise<{ objects: FakeR2Object[] }>
  _store: Map<string, StoredObject>
}

interface FakeR2Object {
  key: string
  httpMetadata: { contentType?: string }
  customMetadata: Record<string, string>
  size: number
  etag: string
  uploaded: Date
  body: ReadableStream<Uint8Array>
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
}

function toR2Object(stored: StoredObject): FakeR2Object {
  return {
    key: stored.key,
    httpMetadata: stored.httpMetadata,
    customMetadata: stored.customMetadata,
    size: stored.body.byteLength,
    etag: stored.etag,
    uploaded: stored.uploaded,
    get body(): ReadableStream<Uint8Array> {
      const bytes = stored.body
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes)
          controller.close()
        },
      })
    },
    arrayBuffer() {
      return Promise.resolve(
        stored.body.buffer.slice(stored.body.byteOffset, stored.body.byteOffset + stored.body.byteLength) as ArrayBuffer
      )
    },
    text() {
      return Promise.resolve(new TextDecoder().decode(stored.body))
    },
  }
}

export function createTestR2(): FakeR2 {
  const store = new Map<string, StoredObject>()
  return {
    async put(key, value, options) {
      const body = await toUint8Array(value)
      const etag = await computeEtag(body)
      store.set(key, {
        key,
        body,
        httpMetadata: options?.httpMetadata ?? {},
        customMetadata: {},
        uploaded: new Date(),
        etag,
      })
      return { key, etag }
    },
    get(key) {
      const stored = store.get(key)
      return Promise.resolve(stored ? toR2Object(stored) : null)
    },
    head(key) {
      const stored = store.get(key)
      return Promise.resolve(stored ? toR2Object(stored) : null)
    },
    delete(key) {
      store.delete(key)
      return Promise.resolve()
    },
    list(options = {}) {
      const prefix = options.prefix ?? ''
      const objects: FakeR2Object[] = []
      for (const [key, stored] of store) {
        if (key.startsWith(prefix)) objects.push(toR2Object(stored))
      }
      return Promise.resolve({ objects })
    },
    _store: store,
  }
}

export function asR2Bucket(fake: FakeR2): R2Bucket {
  return fake as unknown as R2Bucket
}
