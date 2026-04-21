import { client } from '../lib/sanity'
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
      
      {/* HEADER */}
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>
          All Escape Rooms
        </h1>
        <p style={{ fontSize: '20px', color: '#555', maxWidth: '700px', margin: '0 auto' }}>
          Choose your mission. Each room is a fully immersive experience.
        </p>
      </div>

      {/* GRID */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
        gap: '24px' 
         }}>
        
        {rooms.map((room: any) => (
            <Link
            key={room._id}
            href={`/rooms/${room.slug.current}`}
            style={{
                position: 'relative',
                height: '320px',
                borderRadius: '14px',
                overflow: 'hidden',
                display: 'block',
                textDecoration: 'none',
                color: 'white'
            }}
            >

            {/* IMAGE */}
            {room.image && (
                <img
                src={room.image}
                alt={room.title}
                style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    top: 0,
                    left: 0,
                    transition: 'transform 0.4s ease'
                }}
                />
            )}

            {/* OVERLAY */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.2))'
            }} />

            {/* CONTENT */}
            <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                right: '20px'
            }}>
                <h3 style={{ 
                margin: 0, 
                fontSize: '26px',
                fontWeight: 'bold'
                }}>
                {room.title}
                </h3>

                {room.location?.title && (
                <p style={{ 
                    margin: '6px 0 0',
                    fontSize: '14px',
                    opacity: 0.85
                }}>
                    {room.location.title}
                </p>
                )}
            </div>

            </Link>
        ))}

        </div>

    </div>
  )
}