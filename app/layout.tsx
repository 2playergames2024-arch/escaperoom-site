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

        <footer
          style={{
            backgroundColor: '#1a1a1a',
            color: '#aaa',
            textAlign: 'center',
            padding: '40px 20px',
            marginTop: '60px',
          }}
        >
          <p>
            © 2026 Escape Room Mystery • Philadelphia • King of Prussia • Cherry Hill
          </p>
        </footer>
      </body>
    </html>
  )
}