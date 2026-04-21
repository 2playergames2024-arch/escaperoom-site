import BookeoWidget from '../../components/BookeoWidget';
import { client } from '../../lib/sanity';
import Image from 'next/image';

export default async function RoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const room = await client.fetch(
    `*[_type == "room" && slug.current == $slug][0]{
      title,
      description,
      story,
      difficulty,
      duration,
      minPlayers,
      maxPlayers,
      "image": mainImage.asset->url,
      location->{title},
      bookeoTypeWeekday,     // ← add this
      bookeoTypeSaturday     // ← add this
    }`,
    { slug }
  );
    console.log(
    'BOOKEO TYPES:',
    room.bookeoTypeWeekday,
    room.bookeoTypeSaturday
  );
  
  if (!room) {
    return <div>Room not found</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* HERO SECTION - Big room image */}
      {room.image && (
        <div className="relative h-[60vh] w-full">
          <Image
            src={room.image}
            alt={room.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black" />
          
          <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-5xl md:text-6xl font-bold mb-4">{room.title}</h1>
              {room.location?.title && (
                <p className="text-xl text-zinc-300">{room.location.title}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* ROOM INFO BAR */}
        <div className="flex flex-wrap gap-6 mb-12 text-lg">
          <div>👥 {room.minPlayers}–{room.maxPlayers} Players</div>
          <div>⏱ {typeof room.duration === 'number' ? `${room.duration} minutes` : room.duration}</div>
          <div>🔥 {room.difficulty}</div>
        </div>

        {/* DESCRIPTION */}
        {room.description && (
          <div className="prose prose-invert max-w-none mb-16">
            <p className="text-xl leading-relaxed text-zinc-300">{room.description}</p>
          </div>
        )}

        {/* STORY */}
        {room.story && (
          <div className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">The Story</h2>
            <div className="prose prose-invert max-w-none text-zinc-400">
              {room.story}
            </div>
          </div>
        )}

                {/* BOOKING SECTION */}
        <div className="mt-20">
          <div className="mb-8">
            <h2 className="text-4xl font-bold mb-3">Book Your Experience</h2>
            <p className="text-zinc-400 text-lg">
              Choose a date and time below. Available spots are shown in real time.
            </p>
          </div>

          {room.bookeoTypeWeekday ? (
            <BookeoWidget 
              type={room.bookeoTypeWeekday}
              className="shadow-2xl border border-zinc-800 rounded-2xl overflow-hidden"
            />
          ) : (
            <div className="p-8 bg-zinc-900 rounded-2xl border border-zinc-800 text-center">
              <p className="text-red-400">Booking configuration missing for this room.</p>
              <p className="text-sm text-zinc-500 mt-2">Please add Bookeo Type - Weekday in Sanity Studio.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}