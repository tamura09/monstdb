'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

type LoadingContextType = {
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <LoadingContext.Provider value={{ isLoading, setIsLoading }}>
      {children}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-xl p-8 shadow-2xl max-w-sm mx-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
                <div className="animate-ping absolute inset-0 rounded-full h-16 w-16 border-4 border-blue-400 opacity-20"></div>
              </div>
              <div className="text-center">
                <p className="text-xl text-gray-800 font-semibold">処理中...</p>
                <p className="text-sm text-gray-500 mt-1">しばらくお待ちください</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  )
}

export function useLoading() {
  const context = useContext(LoadingContext)
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider')
  }
  return context
}
