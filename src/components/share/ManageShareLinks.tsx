import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { StoredShareLink } from '../../types/share'
import {
  copyToClipboard,
  getStoredShareLinks,
  removeStoredShareLink,
  revokeShareLink,
} from '../../services/shareApi'

interface ManageShareLinksProps {
  refreshKey: number
}

export default function ManageShareLinks({ refreshKey }: ManageShareLinksProps) {
  const [links, setLinks] = useState<StoredShareLink[]>([])
  const [busyToken, setBusyToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLinks(getStoredShareLinks())
  }, [refreshKey])

  const handleCopy = async (url: string) => {
    await copyToClipboard(url)
  }

  const handleRevoke = async (link: StoredShareLink) => {
    if (!confirm('Revoke this link? Anyone with the URL will no longer be able to view it.')) {
      return
    }
    setBusyToken(link.token)
    setError(null)
    try {
      await revokeShareLink(link.token, link.revokeSecret)
      removeStoredShareLink(link.token)
      setLinks(getStoredShareLinks())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke link')
    } finally {
      setBusyToken(null)
    }
  }

  if (links.length === 0) {
    return <p className="text-sm text-slate-400">No active share links on this device.</p>
  }

  return (
    <div>
      <ul className="space-y-2">
        {links.map((link) => (
          <li
            key={link.token}
            className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-100"
          >
            <div className="font-medium text-slate-800">{link.label ?? 'Shared summary'}</div>
            <div className="text-xs text-slate-500">
              Expires {format(parseISO(link.expiresAt), 'd MMM yyyy')}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => handleCopy(link.url)}
                className="text-xs font-medium text-primary-600"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => handleRevoke(link)}
                disabled={busyToken === link.token}
                className="text-xs font-medium text-red-500 disabled:opacity-50"
              >
                {busyToken === link.token ? 'Revoking…' : 'Revoke'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
