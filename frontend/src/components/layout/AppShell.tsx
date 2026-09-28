import React from 'react'
import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'

interface AppShellProps {
  children: React.ReactNode
  hideNavbar?: boolean
  mainClassName?: string
}

export function AppShell({ children, hideNavbar = false, mainClassName = "flex-1 overflow-y-auto mt-6 rounded-[2rem] glass-card p-6 md:p-8" }: AppShellProps) {
  return (
    <div className="flex h-screen p-4 md:p-6 gap-6 bg-bg-app text-text overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {!hideNavbar && <Navbar />}
        <main className={mainClassName}>
          {children}
        </main>
      </div>
    </div>
  )
}
