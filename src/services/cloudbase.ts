import cloudbase from '@cloudbase/js-sdk'
import type { AppData, Entry, ProfileSettings } from '../types'

const ENV_ID = 'personspace-d7glmpjdpd81220f3'

export type CloudUser = {
  id: string
  email?: string | null
  phone?: string | null
  user_metadata?: { username?: string; name?: string; nickName?: string }
}

export type OwnerSignupResult =
  | { user: CloudUser; verifyEmail?: never }
  | { user?: never; verifyEmail: (code: string) => Promise<CloudUser> }

export type PublicProfile = {
  user_id: string
  slug: string
  display_name: string
  headline: string
  bio: string
  current_focus: string
  is_published: boolean
}

export type PublicEntry = {
  id: string
  profile_slug: string
  category_name: string
  title: string
  summary: string
  content: string
  tags: string[]
  published_at: string
}

export type PublicSpace = { profile: PublicProfile; entries: PublicEntry[] }

const ACCESS_KEY = import.meta.env.VITE_CLOUDBASE_ACCESS_KEY
const AUTH_ORIGIN = `https://${ENV_ID}.api.tcloudbasegateway.com`
const RDB_BASE = import.meta.env.DEV
  ? '/cloudbase-rdb'
  : `https://${ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest`

// The embedded development browser cannot establish TLS connections to the
// CloudBase service domains. Route only CloudBase auth requests through Vite's
// same-origin development proxy; production keeps the official HTTPS origin.
if (import.meta.env.DEV) {
  const nativeFetch = globalThis.fetch.bind(globalThis)
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith(`${AUTH_ORIGIN}/auth/`)) return nativeFetch(input, init)
    const parsed = new URL(url)
    return nativeFetch(`/cloudbase-auth${parsed.pathname}${parsed.search}`, init)
  }
}

const cloudAuthApp = cloudbase.init({
  env: ENV_ID,
  region: 'ap-shanghai',
  accessKey: ACCESS_KEY,
  endPointMode: 'GATEWAY',
  persistence: 'local',
})

export const cloudAuth = cloudAuthApp.auth()

async function accessToken() {
  const { data } = await cloudAuth.getSession()
  return data.session?.access_token || ACCESS_KEY
}

async function rdbRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${RDB_BASE}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
      'Accept-Profile': 'public',
      ...init.headers,
    },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string; error_description?: string } | null
    throw new Error(payload?.message || payload?.error_description || `云端请求失败 (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

async function upsert(table: string, row: unknown, conflict = 'user_id') {
  return rdbRequest(`${table}?on_conflict=${conflict}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
  })
}

export async function currentUser(): Promise<CloudUser | null> {
  const { data, error } = await cloudAuth.getUser()
  if (error) return null
  return (data.user as CloudUser | null | undefined) ?? null
}

export async function signIn(email: string, password: string): Promise<CloudUser> {
  const { data, error } = await cloudAuth.signInWithPassword({ email, password })
  if (error || !data.user) throw new Error(error?.message || '登录失败')
  return data.user as CloudUser
}

export async function signUpOwner(email: string, password: string): Promise<OwnerSignupResult> {
  const { data, error } = await cloudAuth.signUp({ email, password, name: '留白' })
  if (error) throw new Error(error.message || '创建账号失败')
  if (data.user) return { user: data.user as CloudUser }
  if (data.verifyOtp) {
    return {
      verifyEmail: async (code: string) => {
        const verified = await data.verifyOtp!({ token: code })
        if (verified.error || !verified.data.user) throw new Error(verified.error?.message || '验证码无效')
        return verified.data.user as CloudUser
      },
    }
  }
  throw new Error('未收到邮箱验证信息，请稍后重试。')
}

export async function signOut() {
  const result = await cloudAuth.signOut()
  const error = (result as { error?: { message?: string } } | undefined)?.error
  if (error) throw new Error(error.message || '退出失败')
}

export async function ownerExists(): Promise<boolean> {
  const rows = await rdbRequest<Array<{ user_id: string }>>('personspace_profiles?select=user_id&is_owner=eq.true&limit=1')
  return rows.length > 0
}

function profileRow(user: CloudUser, profile: ProfileSettings, isOwner: boolean) {
  return {
    user_id: user.id,
    username: user.user_metadata?.username || '',
    slug: profile.slug,
    display_name: profile.displayName,
    headline: profile.headline,
    bio: profile.bio,
    current_focus: profile.currentFocus,
    is_owner: isOwner,
    is_published: profile.published,
  }
}

export async function initializeOwner(user: CloudUser, initialData: AppData) {
  const exists = await ownerExists()
  await upsert('personspace_profiles', profileRow(user, initialData.profile, !exists))
  await upsert('personspace_states', { user_id: user.id, payload: initialData, version: 1 })
  await syncPublicEntries(user, initialData)
}

export async function loadCloudData(user: CloudUser): Promise<AppData | null> {
  const rows = await rdbRequest<Array<{ payload: AppData }>>(`personspace_states?select=payload&user_id=eq.${encodeURIComponent(user.id)}&limit=1`)
  const row = rows[0]
  return row?.payload ?? null
}

export async function saveCloudData(user: CloudUser, data: AppData) {
  await upsert('personspace_states', { user_id: user.id, payload: data, version: 1 })
  await upsert('personspace_profiles', profileRow(user, data.profile, true))
  await syncPublicEntries(user, data)
}

async function syncPublicEntries(user: CloudUser, data: AppData) {
  const publicEntries = data.entries.filter((entry) => entry.visibility === 'public')
  await rdbRequest(`personspace_public_entries?user_id=eq.${encodeURIComponent(user.id)}`, { method: 'DELETE' })
  if (!publicEntries.length) return
  const rows = publicEntries.map((entry: Entry) => ({
    id: entry.id,
    user_id: user.id,
    profile_slug: data.profile.slug,
    category_name: data.categories.find((category) => category.id === entry.categoryId)?.name || '随笔',
    title: entry.title,
    summary: entry.content.slice(0, 140),
    content: entry.content,
    tags: entry.tags,
    published_at: entry.createdAt,
  }))
  await rdbRequest('personspace_public_entries', { method: 'POST', body: JSON.stringify(rows) })
}

export async function loadPublicSpace(slug?: string): Promise<PublicSpace | null> {
  const slugFilter = slug ? `&slug=eq.${encodeURIComponent(slug)}` : ''
  const profiles = await rdbRequest<PublicProfile[]>(`personspace_profiles?select=*&is_owner=eq.true&is_published=eq.true${slugFilter}&limit=1`)
  const profile = profiles[0]
  if (!profile) return null
  const entries = await rdbRequest<PublicEntry[]>(`personspace_public_entries?select=*&user_id=eq.${encodeURIComponent(profile.user_id)}&order=published_at.desc`)
  return { profile, entries }
}

export { ENV_ID }
