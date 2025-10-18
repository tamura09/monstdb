'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function LoadingBar() {
  const [isLoading, setIsLoading] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    setIsLoading(false)
  }, [pathname, searchParams])

  if (!isLoading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-blue-600 animate-pulse">
      <div className="h-full bg-blue-400 animate-[shimmer_1s_ease-in-out_infinite]"></div>
    </div>
  )
}
