// Thin REST layer over the FastAPI backend. Every page uses useApiData, so
// fetching, loading and error handling stay in one place.
import { useEffect, useState } from 'react'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(
  /\/+$/,
  ''
)

// Turns a filter object into a query string, dropping anything the user has
// not set so an unfiltered request stays a bare path (and keeps the useApiData
// cache key stable).
export function buildQuery(params) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return
    if (Array.isArray(value)) {
      if (value.length === 0) return
      search.set(key, value.join(','))
      return
    }
    search.set(key, String(value))
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

// FastAPI answers a rejected body with detail as an array of field errors, and
// everything else with detail as a sentence. Both end up as one readable line.
function readDetail(body, status) {
  if (typeof body?.detail === 'string') return body.detail
  if (Array.isArray(body?.detail)) {
    const messages = body.detail.map((entry) => entry.msg).filter(Boolean)
    if (messages.length > 0) return messages.join('; ')
  }
  return `Request failed with status ${status}`
}

export async function apiGet(path) {
  const response = await fetch(`${API_URL}${path}`)

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`
    try {
      detail = readDetail(await response.json(), response.status)
    } catch {
      // Error responses are not always JSON; the status text is enough then.
    }
    throw new Error(detail)
  }

  return response.json()
}

// The one non-GET call in the application: /api/reports/ask sends a question
// in the body. It still reads nothing but rows back.
export async function apiPost(path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`
    try {
      detail = readDetail(await response.json(), response.status)
    } catch {
      // Same as above: a non-JSON error still has to reach the caller.
    }
    throw new Error(detail)
  }

  return response.json()
}

// Loads a single endpoint and reports its state. "fallback" is what the caller
// gets before the first response arrives, so list pages can pass [].
export function useApiData(path, fallback = null) {
  const [data, setData] = useState(fallback)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    apiGet(path)
      .then((result) => {
        if (!active) return
        setData(result)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(err.message)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [path])

  return { data, loading, error }
}
