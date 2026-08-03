import React from 'react'
import './Layout.css'

type Props = {
  children: React.ReactNode
}

export default function Layout({ children }: Props) {
  return (
    <div className="app-container">
      <main className="app-main">{children}</main>
    </div>
  )
}
