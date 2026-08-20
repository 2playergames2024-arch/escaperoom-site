import Image from "next/image";
import Link from "next/link";

import LocationHeader from "./LocationHeader";
import LocationFooter from "./LocationFooter";

import {
  getLocationBySlug,
  getRoomBySlug,
  type LocationSlug,
} from "../data/locations";

import {
  ROOM_DETAILS,
  type RoomDetailSlug,
} from "../data/roomDetails";

type Props = {
  locationSlug: LocationSlug;
  roomSlug: RoomDetailSlug;
};

const HERO_HEIGHT = 620;
const HERO_TOP_PADDING = 60;
const BUTTON_TOP_MARGIN = 230;
const OVERLAY_OPACITY = 0.15;

const TITLE_TEXT_SHADOW =
  "2px 2px 4px rgba(0,0,0,0.8)";

export default function RoomDetailPage({
  locationSlug,
  roomSlug,
}: Props) {
  const location =
    getLocationBySlug(
      locationSlug
    );

  const room =
    getRoomBySlug(
      locationSlug,
      roomSlug
    );

  const details =
    ROOM_DETAILS[
      roomSlug
    ];

  if (
    !location ||
    !room ||
    !details
  ) {
    throw new Error(
      "Invalid room detail configuration."
    );
  }

  const backRoomsLabel =
    locationSlug ===
    "king-of-prussia"
      ? "Back to KOP Rooms"
      : "Back to Cherry Hill Rooms";

  return (
    <>
      <LocationHeader
        locationName={`${location.shortName}, ${location.state}`}
        locationSubtitle={
          location.subtitle
        }
        homeHref={
          location.homeHref
        }
        roomsHref={
          location.roomsHref
        }
        bookHref={
          location.bookHref
        }
      />

      <main className="min-h-screen bg-white text-slate-950">
        <section
          className="relative overflow-hidden bg-slate-950 text-white"
          style={{
            height:
              `${HERO_HEIGHT}px`,
          }}
        >
          <Image
            src={
              room.image
            }
            alt={
              details.heroAlt
            }
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{
              objectPosition:
                details.heroPosition,
            }}
          />

          <div
            className="absolute inset-0"
            style={{
              backgroundColor:
                `rgba(0, 0, 0, ${OVERLAY_OPACITY})`,
            }}
          />

          <div
            className="relative z-10 mx-auto max-w-7xl px-6"
            style={{
              paddingTop:
                `${HERO_TOP_PADDING}px`,
            }}
          >
            <h1
              className="max-w-4xl font-black leading-tight tracking-tight"
              style={{
                textShadow:
                  TITLE_TEXT_SHADOW,
              }}
            >
              <span className="block text-4xl md:text-6xl">
                {
                  details.heroTitle
                }
              </span>

              <span className="mt-2 block text-3xl md:text-5xl">
                {
                  details.heroSubtitle
                }
              </span>
            </h1>

            <div
              className="flex flex-col gap-4 sm:flex-row"
              style={{
                marginTop:
                  `${BUTTON_TOP_MARGIN}px`,
              }}
            >
              <Link
                href={
                  location.bookHref
                }
                className="rounded-full bg-orange-500 px-8 py-4 text-center text-lg font-black uppercase text-white hover:bg-orange-600"
              >
                Book This Room
              </Link>

              <Link
                href={
                  location.roomsHref
                }
                className="rounded-full border-2 border-white px-8 py-4 text-center text-lg font-black uppercase text-white hover:bg-white hover:text-slate-950"
              >
                {
                  backRoomsLabel
                }
              </Link>
            </div>
          </div>
        </section>

        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="mb-3 text-2xl font-black uppercase tracking-[0.18em] text-orange-500">
                {
                  details
                    .sectionOne
                    .label
                }
              </p>

              <h2 className="mb-7 text-4xl font-black leading-tight md:text-5xl">
                {
                  details
                    .sectionOne
                    .heading
                }
              </h2>

              <div className="space-y-5 text-lg leading-relaxed text-slate-700">
                {details.sectionOne.paragraphs.map(
                  (
                    paragraph
                  ) => (
                    <p
                      key={
                        paragraph
                      }
                    >
                      {
                        paragraph
                      }
                    </p>
                  )
                )}

                <p className="pt-1 text-xl font-black text-slate-950">
                  {
                    details
                      .sectionOne
                      .emphasis
                  }
                </p>
              </div>
            </div>

            <Image
              src={
                details
                  .sectionOne
                  .image
              }
              alt={
                details
                  .sectionOne
                  .imageAlt
              }
              width={1200}
              height={800}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="h-auto w-full rounded-[32px] shadow-xl"
            />
          </div>
        </section>

        <section className="border-y border-slate-100 bg-white px-6 py-16 md:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Image
              src={
                details
                  .sectionTwo
                  .image
              }
              alt={
                details
                  .sectionTwo
                  .imageAlt
              }
              width={1200}
              height={800}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="order-2 h-auto w-full rounded-[32px] shadow-xl lg:order-1"
            />

            <div className="order-1 lg:order-2">
              <p className="mb-3 text-2xl font-black uppercase tracking-[0.18em] text-orange-500">
                {
                  details
                    .sectionTwo
                    .label
                }
              </p>

              <h2 className="mb-7 text-4xl font-black leading-tight md:text-5xl">
                {
                  details
                    .sectionTwo
                    .heading
                }
              </h2>

              <div className="space-y-5 text-lg leading-relaxed text-slate-700">
                {details.sectionTwo.paragraphs.map(
                  (
                    paragraph
                  ) => (
                    <p
                      key={
                        paragraph
                      }
                    >
                      {
                        paragraph
                      }
                    </p>
                  )
                )}

                <p className="pt-1 text-xl font-black text-slate-950">
                  {
                    details
                      .sectionTwo
                      .emphasis
                  }
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-100 px-6 py-16 md:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="mb-3 text-2xl font-black uppercase tracking-[0.18em] text-orange-500">
                {
                  details
                    .sectionThree
                    .label
                }
              </p>

              <h2 className="mb-7 text-4xl font-black leading-tight md:text-5xl">
                {
                  details
                    .sectionThree
                    .heading
                }
              </h2>

              <div className="space-y-5 text-lg leading-relaxed text-slate-700">
                {details.sectionThree.paragraphs.map(
                  (
                    paragraph
                  ) => (
                    <p
                      key={
                        paragraph
                      }
                    >
                      {
                        paragraph
                      }
                    </p>
                  )
                )}

                <p className="pt-1 text-xl font-black text-slate-950">
                  {
                    details
                      .sectionThree
                      .emphasis
                  }
                </p>
              </div>
            </div>

            <Image
              src={
                details
                  .sectionThree
                  .image
              }
              alt={
                details
                  .sectionThree
                  .imageAlt
              }
              width={1200}
              height={800}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="h-auto w-full rounded-[32px] shadow-xl"
            />
          </div>
        </section>

        <section className="bg-slate-950 px-6 py-16 text-white md:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 text-center">
              <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-orange-400">
                Room Details
              </p>

              <h2 className="text-4xl font-black md:text-5xl">
                Plan Your Escape
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                [
                  "Duration",
                  "60 Minutes",
                ],
                [
                  "Players",
                  `${room.minPlayers}–${room.maxPlayers} Players`,
                ],
                [
                  "Location",
                  location.shortName,
                ],
              ].map(
                ([
                  label,
                  value,
                ]) => (
                  <div
                    key={
                      label
                    }
                    className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-center"
                  >
                    <p className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-orange-400">
                      {
                        label
                      }
                    </p>

                    <h3 className="text-3xl font-black">
                      {
                        value
                      }
                    </h3>
                  </div>
                )
              )}
            </div>
          </div>
        </section>

        <section className="bg-orange-500 px-6 py-16 text-center text-white md:py-20">
          <h2 className="mx-auto mb-6 max-w-3xl text-4xl font-black md:text-6xl">
            {
              details.ctaHeading
            }
          </h2>

          <p className="mx-auto mb-8 max-w-2xl text-xl font-semibold">
            {
              details.ctaLead
            }{" "}
            at our{" "}
            {
              location.shortName
            }{" "}
            location.
          </p>

          <Link
            href={
              location.bookHref
            }
            className="inline-block rounded-full bg-slate-950 px-10 py-5 text-lg font-black uppercase text-white"
          >
            Book This Room
          </Link>
        </section>
      </main>

      <LocationFooter
        locationName={
          location.shortName
        }
        streetAddress={
          location.streetAddress
        }
        cityStateZip={
          location.cityStateZip
        }
        phone={
          location.phone
        }
        bookHref={
          location.bookHref
        }
        roomsHref={
          location.roomsHref
        }
      />
    </>
  );
}