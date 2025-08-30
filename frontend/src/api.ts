const BASE = (import.meta.env.VITE_API_URL as string) || '/api' // optionally proxied

export async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(path.startsWith('http') ? path : `${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.method && opts.method !== 'GET' ? {'X-CSRF-Token': getCookie('lgs_csrf') || ''} : {})
    },
    ...opts
  })
  if (!res.ok) throw new Error(`${res.status}`)
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return res.text()
}

export function getCookie(name: string): string | null {
  const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')
  return m ? m.pop() || null : null
}


export async function me() {
  try {
    return await api('/me');
  } catch (e) {
    return null;
  }
}
