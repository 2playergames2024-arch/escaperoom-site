import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: "Escape Rooms in King of Prussia & Cherry Hill | Escape Room Mystery",
    template: "%s | Escape Room Mystery",
  },
  description:
    "Immersive escape rooms in King of Prussia, PA and Cherry Hill, NJ. Explore cinematic sets, challenging puzzles, private rooms, parties, and team-building adventures.",
};

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