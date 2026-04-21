import { client } from './lib/sanity'
import Link from 'next/link'

async function getRooms() {
  return client.fetch(`*[_type == "room"]{ 
    _id,
    title, 
    description,
    slug,
    "image": mainImage.asset->url,
    location->{title}
  }`)
}

export default async function RoomsPage() {
  const rooms = await getRooms()

  return (
    <div style={{ padding: '60px 40px', maxWidth: '1200px', margin: '0 auto' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>
          All Escape Rooms
        </h1>
        <p style={{ fontSize: '20px', color: '#555', maxWidth: '700px', margin: '0 auto' }}>
          Choose your mission. Each room is a fully immersive experience.
        </p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', 
        gap: '30px' 
      }}>
        
        {rooms.map((room: any) => (
          <Link
            key={room._id}
            href={`/rooms/${room.slug.current}`}
            style={{
              border: '1px solid #ddd',
              borderRadius: '12px',
              overflow: 'hidden',
              textDecoration: 'none',
              color: 'inherit',
              backgroundColor: 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              display: 'block'
            }}
          >
            
            {/* IMAGE */}
            {room.image && (
              <img
                src={room.image}
                alt={room.title}
                style={{
                  width: '100%',
                  height: '220px',
                  objectFit: 'cover'
                }}
              />
            )}

            {/* CONTENT */}
            <div style={{ padding: '25px' }}>
              
              <h3 style={{ marginTop: 0, fontSize: '24px' }}>
                {room.title}
              </h3>

              {/* LOCATION */}
              {room.location?.title && (
                <p style={{ fontSize: '14px', color: '#888', marginBottom: '10px' }}>
                  {room.location.title}
                </p>
              )}

              <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#444' }}>
                {room.description}
              </p>

            </div>

            {/* CTA */}
            <div style={{ 
              padding: '18px', 
              backgroundColor: '#f8f8f8',
              textAlign: 'center',
              borderTop: '1px solid #eee'
            }}>
              <span style={{
                display: 'inline-block',
                padding: '10px 24px',
                backgroundColor: '#1a1a1a',
                color: 'white',
                borderRadius: '6px',
                fontWeight: 'bold'
              }}>
                View Room
              </span>
            </div>

          </Link>
        ))}

      </div>
    </div>
  )
}