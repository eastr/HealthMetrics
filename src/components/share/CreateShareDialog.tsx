import { useState } from 'react'
import type { HealthEntry } from '../../types/entry'
import type { ShareDataRange, ShareLinkExpiry } from '../../types/share'
import { toShareSnapshot } from '../../utils/shareSnapshot'
import {
  addStoredShareLink,
  copyToClipboard,
  createShareLink,
} from '../../services/shareApi'

interface CreateShareDialogProps {
  entries: HealthEntry[]
  onClose: () => void
  onCreated?: () => void
}

const DATA_RANGES: { value: ShareDataRange; label: string }[] = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 'all', label: 'All data' },
]

const EXPIRY_OPTIONS: { value: ShareLinkExpiry; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
]

export default function CreateShareDialog({ entries, onClose, onCreated }: CreateShareDialogProps) {
  const [dataRange, setDataRange] = useState<ShareDataRange>(30)
  const [linkExpiry, setLinkExpiry] = useState<ShareLinkExpiry>(30)
  const [includeNotes, setIncludeNotes] = useState(true)
  const [label, setLabel] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!confirmed) {
      setError('Please confirm you understand the privacy notice.')
      return
    }

    setCreating(true)
    setError(null)
    try {
      const { payload } = toShareSnapshot(entries, {
        dataRange,
        includeNotes,
        linkExpiryDays: linkExpiry,
        label: label || undefined,
      })

      if (payload.entries.length === 0) {
        setError('No entries in the selected date range.')
        return
      }

      const result = await createShareLink(payload)
      addStoredShareLink({
        token: result.token,
        revokeSecret: result.revokeSecret,
        label: label || undefined,
        expiresAt: result.expiresAt,
        url: result.url,
        createdAt: new Date().toISOString(),
      })
      await copyToClipboard(result.url)
      setCreatedUrl(result.url)
      onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create link')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        role="dialog"
        aria-labelledby="create-share-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="create-share-title" className="text-lg font-semibold text-slate-800">
            Create share link
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {createdUrl ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-700">
              Link created and copied to clipboard.
            </p>
            <input
              readOnly
              value={createdUrl}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copyToClipboard(createdUrl)}
                className="flex-1 rounded-xl bg-primary-700 py-2.5 text-sm font-semibold text-white"
              >
                Copy again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-100">
              Anyone with this link can view the health data you include until the link
              expires. Only share with people you trust, such as your doctor.
            </div>

            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              I understand this creates a read-only copy of my data
            </label>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Data to include
              </label>
              <div className="flex flex-wrap gap-1">
                {DATA_RANGES.map(({ value, label: rangeLabel }) => (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => setDataRange(value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      dataRange === value
                        ? 'bg-primary-700 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {rangeLabel}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Link expires in
              </label>
              <div className="flex gap-1">
                {EXPIRY_OPTIONS.map(({ value, label: expiryLabel }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLinkExpiry(value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      linkExpiry === value
                        ? 'bg-primary-700 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {expiryLabel}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includeNotes}
                onChange={(e) => setIncludeNotes(e.target.checked)}
              />
              Include notes
            </label>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="share-label">
                Label (optional)
              </label>
              <input
                id="share-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. For Dr Smith"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !confirmed}
                className="flex-1 rounded-xl bg-primary-700 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
