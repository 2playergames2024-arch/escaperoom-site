"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type LocationHeaderProps = {
  locationName: string;
  locationSubtitle: string;
  homeHref: string;
  roomsHref: string;
  bookHref: string;
};

export default function LocationHeader({
  locationName,
  locationSubtitle,
  homeHref,
  roomsHref,
  bookHref,
}: LocationHeaderProps) {
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [mobileLocationOpen, setMobileLocationOpen] = useState(false);
  const locationMenuRef = useRef<HTMLDivElement>(null);
  const navMenuRef = useRef<HTMLDivElement>(null);

  const isKingOfPrussia = locationName
    .toLowerCase()
    .includes("king of prussia");

  const currentLocationShortName = isKingOfPrussia
    ? "King of Prussia"
    : "Cherry Hill";

  const otherLocation = isKingOfPrussia
    ? {
      shortName: "Cherry Hill",
      href: "/locations/cherry-hill",
    }
    : {
      shortName: "King of Prussia",
      href: "/locations/king-of-prussia",
    };

  const giftVoucherHref = isKingOfPrussia
    ? "/gift-vouchers/details?location=king-of-prussia"
    : "/gift-vouchers/details?location=cherry-hill";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const clickedNode = event.target as Node;

      if (
        locationMenuRef.current &&
        !locationMenuRef.current.contains(clickedNode)
      ) {
        setLocationMenuOpen(false);
      }

      if (
        navMenuRef.current &&
        !navMenuRef.current.contains(clickedNode)
      ) {
        setNavMenuOpen(false);
        setMobileLocationOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLocationMenuOpen(false);
        setNavMenuOpen(false);
        setMobileLocationOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <header className="location-header">
      <div className="location-header-inner">
        {/* LEFT: LOGO */}
        <Link href="/" className="location-header-logo">
          <span>ESCAPE ROOM</span>
          <span>MYSTERY</span>
        </Link>

        {/* CENTER: NAVIGATION */}
        <>
          <nav
            className="location-header-nav"
            aria-label="Location navigation"
          >
            <div className="desktop-nav">
              <Link href={homeHref}>Home</Link>
              <Link href={roomsHref}>Explore Rooms</Link>
              <Link href={giftVoucherHref}>Gift Vouchers</Link>
            </div>

            <div
              ref={navMenuRef}
              className="location-mobile-nav"
            >
              <button
                type="button"
                className="hamburger-button"
                onClick={() => setNavMenuOpen((open) => !open)}
                aria-label="Menu"
                aria-expanded={navMenuOpen}
                aria-controls="mobile-navigation-menu"
              >
                ☰
              </button>

              {navMenuOpen && (
                <div
                  id="mobile-navigation-menu"
                  className="hamburger-menu"
                >
                  <button
                    type="button"
                    className="hamburger-location"
                    onClick={() =>
                      setMobileLocationOpen((open) => !open)
                    }
                    aria-expanded={mobileLocationOpen}
                    aria-controls="mobile-location-menu"
                  >
                    <div className="hamburger-location-title">
                      {locationName}
                    </div>

                    <div className="hamburger-location-subtitle">
                      {locationSubtitle}
                    </div>
                  </button>

                  {mobileLocationOpen && (
                    <div
                      id="mobile-location-menu"
                      className="mobile-location-menu"
                    >
                      <button
                        type="button"
                        className="mobile-location-item active"
                        onClick={() => {
                          setMobileLocationOpen(false);
                          setNavMenuOpen(false);
                        }}
                      >
                        ✓ Stay at {currentLocationShortName}
                      </button>

                      <Link
                        href={otherLocation.href}
                        className="mobile-location-item"
                        onClick={() => {
                          setMobileLocationOpen(false);
                          setNavMenuOpen(false);
                        }}
                      >
                        Go to {otherLocation.shortName}
                      </Link>
                    </div>
                  )}

                  <Link
                    href={homeHref}
                    onClick={() => setNavMenuOpen(false)}
                  >
                    Home
                  </Link>

                  <Link
                    href={roomsHref}
                    onClick={() => setNavMenuOpen(false)}
                  >
                    Explore Rooms
                  </Link>

                  <Link
                    href={giftVoucherHref}
                    onClick={() => setNavMenuOpen(false)}
                  >
                    Gift Vouchers
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </>

        {/* RIGHT: LOCATION + BOOK NOW */}
        <div className="location-header-right">
          {/* LOCATION SELECTOR */}
          <div
            ref={locationMenuRef}
            className="location-selector-wrapper"
          >
            <button
              type="button"
              onClick={() =>
                setLocationMenuOpen((current) => !current)
              }
              aria-expanded={locationMenuOpen}
              aria-controls="location-dropdown-menu"
              aria-label={`Change location. Current location: ${locationName}`}
              className="location-selector"
            >
              <span className="location-name">
                {locationName}
              </span>

              <span className="location-subtitle">
                {locationSubtitle}
              </span>
            </button>

            {locationMenuOpen && (
              <div
                id="location-dropdown-menu"
                className="location-dropdown"
              >
                <button
                  type="button"
                  onClick={() => setLocationMenuOpen(false)}
                  className="location-dropdown-button"
                >
                  Stay at {currentLocationShortName}
                </button>

                <p className="location-question">
                  Looking for another location?
                </p>

                <Link
                  href={otherLocation.href}
                  onClick={() => setLocationMenuOpen(false)}
                  className="location-dropdown-button"
                >
                  Go to {otherLocation.shortName}
                </Link>

                <p className="location-warning">
                  Please confirm your location before booking.
                  Each location has different rooms and
                  availability.
                </p>
              </div>
            )}
          </div>

          {/* BOOK NOW */}
          <Link
            href={bookHref}
            className="location-book-button"
          >
            Book Now
          </Link>
        </div>
      </div>

      <style jsx global>{`
        .location-header {
          position: sticky;
          top: 0;
          z-index: 50;
          width: 100%;
          border-bottom: 1px solid rgb(226 232 240);
          background: white;
        }

        .mobile-location-menu {
          margin: 8px 0 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgb(226 232 240);

          display: flex;
          flex-direction: column;
        }

        .mobile-location-item {
          display: block;
          width: 100%;
          padding: 10px 0;

          border: 0;
          background: none;

          text-align: left;
          text-decoration: none;

          color: rgb(15 23 42);
          font-size: 15px;
          font-weight: 700;

          cursor: pointer;
        }

        .mobile-location-item:hover {
          color: rgb(249 115 22);
        }

        .mobile-location-item.active {
          font-weight: 900;
        }

        .location-header-inner {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          width: 100%;
          max-width: 1280px;
          min-height: 78px;
          margin: 0 auto;
          padding: 14px 24px;
          column-gap: 28px;
        }

        .location-header-logo {
          justify-self: start;
          display: flex;
          flex-direction: column;
          color: rgb(15 23 42);
          font-size: 18px;
          font-weight: 900;
          line-height: 1;
          text-decoration: none;
        }

        .location-header-logo span {
          white-space: nowrap;
        }

        @media (min-width: 1101px) {
          .location-header-logo {
            flex-direction: row;
            gap: 6px;
          }
        }

        .location-header-nav {
          display: flex;
          justify-self: center;
          align-self: start;
          align-items: center;
          gap: 34px;
          padding-top: 2px;
        }

        .location-header-nav a {
          white-space: nowrap;
          color: rgb(15 23 42);
          font-size: 16px;
          font-weight: 900;
          text-decoration: none;
        }

        .location-header-nav a:hover {
          color: rgb(249 115 22);
        }

        .location-header-right {
          display: flex;
          justify-self: end;
          align-items: center;
          gap: 24px;
          white-space: nowrap;
        }

        .location-selector-wrapper {
          position: relative;
        }

        .location-selector {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 7px 9px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          cursor: pointer;
          text-align: left;
        }

        .location-selector:hover {
          background: rgb(241 245 249);
        }

        .location-name {
          white-space: nowrap;
          color: rgb(15 23 42);
          font-size: 14px;
          font-weight: 900;
          line-height: 1.1;
          text-transform: uppercase;
        }

        .location-subtitle {
          margin-top: 4px;
          white-space: nowrap;
          color: rgb(100 116 139);
          font-size: 12px;
          font-weight: 700;
          line-height: 1.1;
        }

        .location-book-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 142px;
          min-height: 50px;
          padding: 14px 27px;
          border-radius: 9999px;
          background: rgb(249 115 22);
          color: white;
          font-size: 14px;
          font-weight: 900;
          line-height: 1;
          text-decoration: none;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .location-book-button:hover {
          background: rgb(234 88 12);
        }

        .location-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 290px;
          padding: 20px;
          border: 1px solid rgb(226 232 240);
          border-radius: 18px;
          background: white;
          box-shadow:
            0 20px 25px -5px rgb(0 0 0 / 0.15),
            0 8px 10px -6px rgb(0 0 0 / 0.1);
        }

        .location-dropdown-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 48px;
          padding: 12px 20px;
          border: 0;
          border-radius: 9999px;
          background: rgb(2 6 23);
          color: white;
          font-size: 14px;
          font-weight: 900;
          text-align: center;
          text-decoration: none;
          text-transform: uppercase;
          cursor: pointer;
        }

        .location-dropdown-button:hover {
          background: rgb(30 41 59);
        }

        .location-question {
          margin: 20px 0 12px;
          color: rgb(15 23 42);
          font-size: 14px;
          font-weight: 900;
          line-height: 1.35;
        }

        .location-warning {
          margin: 18px 0 0;
          color: rgb(100 116 139);
          font-size: 12px;
          font-weight: 600;
          line-height: 1.6;
          white-space: normal;
        }

        .desktop-nav {
          display: flex;
          gap: 34px;
        }

        .location-mobile-nav {
          display: none;
          position: relative;
        }

        .hamburger-button {
          border: 0;
          background: transparent;
          color: rgb(15 23 42);
          font-size: 28px;
          font-weight: 900;
          cursor: pointer;
        }

        .hamburger-location-title {
          font-size: 18px;
          font-weight: 900;
          color: rgb(15 23 42);
          line-height: 1.2;
        }

        .hamburger-location-subtitle {
          margin-top: 4px;
          font-size: 13px;
          font-weight: 600;
          color: rgb(100 116 139);
          line-height: 1.2;
        }

        .hamburger-location {
          display: flex;
          flex-direction: column;
          align-items: flex-start;

          width: 100%;
          padding: 0 0 12px 0;
          margin-bottom: 12px;

          border: 0;
          border-bottom: 1px solid rgb(226 232 240);
          background: none;

          cursor: pointer;
          text-align: left;
        }

        .hamburger-location:hover {
          color: rgb(249 115 22);
        }

        .hamburger-menu {
          position: absolute;
          top: calc(100% + 10px);
          left: 0;

          width: 230px;
          padding: 16px;

          border: 1px solid rgb(226 232 240);
          border-radius: 16px;
          background: white;

          box-shadow:
            0 20px 25px -5px rgb(0 0 0 / 0.15),
            0 8px 10px -6px rgb(0 0 0 / 0.1);

          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .hamburger-menu a,
        .hamburger-menu button {
          display: block;
          width: 100%;
          padding: 8px 0;

          border: 0;
          background: none;

          text-align: left;
          text-decoration: none;

          color: rgb(15 23 42);
          font-size: 16px;
          font-weight: 800;

          cursor: pointer;
        }

        .location-header a:focus-visible,
        .location-header button:focus-visible {
          outline: 3px solid rgb(249 115 22);
          outline-offset: 3px;
        }

        @media (max-width: 900px) {
          .location-header-inner {
            grid-template-columns: auto 1fr auto;
          }

          .location-header-nav {
            justify-self: start;
          }

          .location-header-right {
            justify-self: end;
          }

          .location-header-nav {
            justify-self: start;
            align-self: center;
            padding-top: 0;
          }

          .desktop-nav {
            display: none;
          }

          .location-mobile-nav {
            display: block;
          }

          .location-selector-wrapper {
            position: absolute;
            top: 70px;
            right: 24px;
            visibility: hidden;
            pointer-events: none;
          }

          .location-header-right {
            justify-self: end;
          }
        }
      `}</style>
    </header>
  );
}