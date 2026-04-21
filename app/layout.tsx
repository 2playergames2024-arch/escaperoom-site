import type { Metadata } from 'next'
import './globals.css'   // We'll create this file next if it doesn't exist

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
      <body style={{ 
        margin: 0, 
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#f8f8f8'
      }}>
        {/* Header */}
        <header style={{
          backgroundColor: '#1a1a1a',
          color: 'white',
          padding: '20px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{ margin: 0, fontSize: '28px' }}>Escape Room Mystery</h1>
          
          <nav style={{ display: 'flex', gap: '30px' }}>
            <a href="/" style={{ color: 'white', textDecoration: 'none' }}>Home</a>
            <a href="/rooms" style={{ color: 'white', textDecoration: 'none' }}>Rooms</a>
            <a href="/locations" style={{ color: 'white', textDecoration: 'none' }}>Locations</a>
            <a href="/book" style={{ color: 'white', textDecoration: 'none' }}>Book Now</a>
          </nav>
        </header>

        {/* Main Content */}
        <main>
          {children}
        </main>

        {/* Footer */}
        <footer style={{
          backgroundColor: '#1a1a1a',
          color: '#aaa',
          textAlign: 'center',
          padding: '40px 20px',
          marginTop: '60px'
        }}>
          <p>© 2026 Escape Room Mystery • Philadelphia • King of Prussia • Cherry Hill</p>
        </footer>
      </body>
    </html>
  )
}