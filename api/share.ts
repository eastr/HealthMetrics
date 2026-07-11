import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from '@vercel/kv'
import { parseCreatePayload, type ShareRecordStored } from './_lib/shareRecord.js'

const MAX_BODY_BYTES = 500_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const contentLength = req.headers['content-length']
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Payload too large' })
  }

  const payload = parseCreatePayload(req.body)
  if (!payload) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  if (payload.entries.length > 10_000) {
    return res.status(413).json({ error: 'Too many entries' })
  }

  try {
    const token = crypto.randomUUID()
    const revokeSecret = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    const expiresAt = new Date(
      Date.now() + payload.linkExpiryDays * 24 * 60 * 60 * 1000,
    ).toISOString()

    const record: ShareRecordStored = {
      createdAt,
      expiresAt,
      label: payload.label,
      dateFrom: payload.dateFrom,
      dateTo: payload.dateTo,
      includeNotes: payload.includeNotes,
      entries: payload.entries,
      revokeSecret,
    }

    await kv.set(`share:${token}`, record, { ex: payload.linkExpiryDays * 24 * 60 * 60 })

    const host = req.headers['x-forwarded-host'] ?? req.headers.host
    const proto = req.headers['x-forwarded-proto'] ?? 'https'
    const origin = host ? `${proto}://${host}` : ''
    const url = origin ? `${origin}/share/${token}` : `/share/${token}`

    return res.status(201).json({
      token,
      url,
      revokeSecret,
      expiresAt,
    })
  } catch (err) {
    console.error('Failed to create share link:', err)
    return res.status(500).json({ error: 'Failed to create share link' })
  }
}
