import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Escape Room Mystery',
  description: 'Premier Escape Room Experiences',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'Arial, sans-serif',
          backgroundColor: '#f8f8f8',
        }}
      >
        <main>
          {children}
        </main>
        
      </body>
    </html>
  )
}