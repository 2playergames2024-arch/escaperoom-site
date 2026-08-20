"use client";

export default function LocationHeroVideo() {
  return (
    <video
      autoPlay
      muted
      playsInline
      aria-hidden="true"
      className="h-full w-full object-cover"
      onTimeUpdate={(event) => {
        const video = event.currentTarget;

        if (video.currentTime >= 17) {
          video.currentTime = 0;
          video.play();
        }
      }}
    >
      <source
        src="/videos/hero.mp4"
        type="video/mp4"
      />
    </video>
  );
}