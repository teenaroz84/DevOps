import React, { createContext, useContext, useState } from 'react'

interface MockDataContextType {
  useMock: boolean
  toggleMock: () => void
}

const MockDataContext = createContext<MockDataContextType>({
  useMock: false,
  toggleMock: () => {},
})

export const MockDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [useMock, setUseMock] = useState<boolean>(() => {
    try { return localStorage.getItem('dataops-use-mock') === 'true' } catch { return false }
  })

  const toggleMock = () => {
    setUseMock(prev => {
      try { localStorage.setItem('dataops-use-mock', String(!prev)) } catch {}
      return !prev
    })
  }

  return (
    <MockDataContext.Provider value={{ useMock, toggleMock }}>
      {children}
    </MockDataContext.Provider>
  )
}

export const useMockData = () => useContext(MockDataContext)
