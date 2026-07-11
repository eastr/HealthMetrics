import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from '@vercel/kv'
import { isValidToken, toPublicRecord, type ShareRecordStored } from '../_lib/shareRecord.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = req.query.token
  if (typeof token !== 'string' || !isValidToken(token)) {
    return res.status(400).json({ error: 'Invalid token' })
  }

  const key = `share:${token}`

  if (req.method === 'GET') {
    try {
      const record = await kv.get<ShareRecordStored>(key)
      if (!record) {
        return res.status(404).json({ error: 'Share link not found or expired' })
      }
      if (new Date(record.expiresAt) < new Date()) {
        await kv.del(key)
        return res.status(404).json({ error: 'Share link expired' })
      }
      return res.status(200).json(toPublicRecord(record))
    } catch (err) {
      console.error('Failed to fetch share link:', err)
      return res.status(500).json({ error: 'Failed to load share link' })
    }
  }

  if (req.method === 'DELETE') {
    const revokeSecret = req.headers['x-revoke-secret']
    if (typeof revokeSecret !== 'string') {
      return res.status(401).json({ error: 'Missing revoke secret' })
    }

    try {
      const record = await kv.get<ShareRecordStored>(key)
      if (!record) {
        return res.status(404).json({ error: 'Share link not found or expired' })
      }
      if (record.revokeSecret !== revokeSecret) {
        return res.status(403).json({ error: 'Invalid revoke secret' })
      }
      await kv.del(key)
      return res.status(204).end()
    } catch (err) {
      console.error('Failed to revoke share link:', err)
      return res.status(500).json({ error: 'Failed to revoke share link' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
