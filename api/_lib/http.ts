import type { VercelRequest, VercelResponse } from '@vercel/node'

/* Small HTTP plumbing, shared by the api/ functions.

   Every failure leaves here as one shape - { error: { code, message } } - so
   the browser can switch on a stable code and still have a sentence to show
   when it does not recognise one. */

export class HttpError extends Error {
  status: number
  code: string
  /** What to put in the Allow header when this is a 405. */
  allow?: string

  constructor(status: number, code: string, message: string, allow?: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.allow = allow
  }
}

export function json(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).json(body)
}

/** Vercel parses JSON bodies for us, but not reliably for every content type. */
export function readJson(req: VercelRequest): Record<string, unknown> {
  const body = req.body
  if (body == null) return {}
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>
    } catch {
      throw new HttpError(400, 'invalid_body', 'The request body is not valid JSON.')
    }
  }
  if (typeof body === 'object') return body as Record<string, unknown>
  throw new HttpError(400, 'invalid_body', 'The request body is not valid JSON.')
}

export function requirePost(req: VercelRequest): void {
  requireMethod(req, 'POST')
}

export function requireGet(req: VercelRequest): void {
  requireMethod(req, 'GET')
}

function requireMethod(req: VercelRequest, method: 'GET' | 'POST'): void {
  if (req.method !== method) {
    throw new HttpError(
      405,
      'method_not_allowed',
      `${req.method ?? 'That method'} is not allowed here.`,
      method,
    )
  }
}

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>

/* Wraps a handler so an HttpError becomes its own status and anything else
   becomes a 500 that says nothing. The unexpected case is logged in full
   server-side and reported as one word to the client - an error message is a
   fine place to leak a token or a connection string. */
export function handle(fn: Handler): Handler {
  return async (req, res) => {
    try {
      await fn(req, res)
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 405) res.setHeader('Allow', err.allow ?? 'POST')
        json(res, err.status, { error: { code: err.code, message: err.message } })
        return
      }
      console.error('[api] unhandled', err)
      json(res, 500, {
        error: { code: 'internal', message: 'Something went wrong on our side.' },
      })
    }
  }
}
