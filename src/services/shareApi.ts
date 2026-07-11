import type {
  CreateSharePayload,
  CreateShareResponse,
  ShareRecordPublic,
  StoredShareLink,
} from '../types/share'

const STORAGE_KEY = 'healthmetrics_share_links'

export function getStoredShareLinks(): StoredShareLink[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredShareLink[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((l) => new Date(l.expiresAt) > new Date())
  } catch {
    return []
  }
}

function saveStoredShareLinks(links: StoredShareLink[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links))
}

export function addStoredShareLink(link: StoredShareLink): void {
  const links = getStoredShareLinks().filter((l) => l.token !== link.token)
  saveStoredShareLinks([link, ...links])
}

export function removeStoredShareLink(token: string): void {
  saveStoredShareLinks(getStoredShareLinks().filter((l) => l.token !== token))
}

export async function createShareLink(payload: CreateSharePayload): Promise<CreateShareResponse> {
  const response = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `Failed to create link (${response.status})`)
  }

  const data = (await response.json()) as CreateShareResponse
  const url = data.url.startsWith('http') ? data.url : `${window.location.origin}${data.url}`
  return { ...data, url }
}

export async function fetchShareRecord(token: string): Promise<ShareRecordPublic> {
  const response = await fetch(`/api/share/${token}`, {
    headers: { Accept: 'application/json' },
  })
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error('Share API unavailable — redeploy may be required')
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `Failed to load share (${response.status})`)
  }
  return response.json() as Promise<ShareRecordPublic>
}

export async function revokeShareLink(token: string, revokeSecret: string): Promise<void> {
  const response = await fetch(`/api/share/${token}`, {
    method: 'DELETE',
    headers: { 'x-revoke-secret': revokeSecret },
  })

  if (!response.ok && response.status !== 204) {
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `Failed to revoke link (${response.status})`)
  }
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}
