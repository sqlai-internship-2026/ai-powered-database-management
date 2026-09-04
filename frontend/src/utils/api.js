// Thin REST layer over the FastAPI backend. Every page uses useApiData, so
// fetching, loading and error handling stay in one place.
import { useEffect, useState } from 'react'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(
  /\/+$/,
  ''
)

export async function apiGet(path) {
  const response = await fetch(`${API_URL}${path}`)

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`
    try {
      const body = await response.json()
      if (body?.detail) detail = body.detail
    } catch {
      // Error responses are not always JSON; the status text is enough then.
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
