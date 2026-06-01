import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export function InfiniteScrollTrigger({
  onLoadMore,
  disabled,
  rootMargin = '200px',
  className
}) {
  const ref = useRef(null)

  useEffect(() => {
    if (disabled) return
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) onLoadMore?.()
      },
      { root: null, rootMargin, threshold: 0 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [disabled, onLoadMore, rootMargin])

  return <div ref={ref} className={cn('h-px w-full', className)} />
}

