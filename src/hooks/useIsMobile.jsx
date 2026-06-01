import { useEffect, useState } from 'react'

export function useIsMobile(breakpointPx = 640) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(`(max-width: ${breakpointPx - 1}px)`).matches
  })

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)
    const onChange = () => setIsMobile(media.matches)

    onChange()
    media.addEventListener?.('change', onChange)
    media.addListener?.(onChange)

    return () => {
      media.removeEventListener?.('change', onChange)
      media.removeListener?.(onChange)
    }
  }, [breakpointPx])

  return isMobile
}

