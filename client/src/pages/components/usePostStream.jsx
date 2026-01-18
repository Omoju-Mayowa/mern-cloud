import { useEffect } from 'react'

// Simple SSE hook that connects to the server stream and calls `onMessage` with parsed payload
export default function usePostStream(onMessage) {
  useEffect(() => {
    const url = `${import.meta.env.VITE_API_BASE_URL}/posts/stream`
    const es = new EventSource(url)

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data)
        if (parsed && parsed.event) {
          onMessage(parsed.event, parsed.payload)
        }
      } catch (err) {
        // ignore parse errors
        console.error('SSE parse error', err)
      }
    }

    es.onerror = (err) => {
      // keep connection open; browser will retry by default
      console.warn('SSE connection error', err)
    }

    return () => {
      es.close()
    }
  }, [onMessage])
}
