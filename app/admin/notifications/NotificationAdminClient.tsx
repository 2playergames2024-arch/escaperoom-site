"use client";

import { useMemo, useState } from "react";

const DAYS = [
  ["sun", "Sun"],
  ["mon", "Mon"],
  ["tue", "Tue"],
  ["wed", "Wed"],
  ["thu", "Thu"],
  ["fri", "Fri"],
  ["sat", "Sat"],
] as const;

const LOCATION_LABELS = {
  "king-of-prussia": "King of Prussia",
  "cherry-hill": "Cherry Hill",
} as const;

type RecipientKey =
  | "noel"
  | "david"
  | "kopTracfone"
  | "chTracfone";

type LocationKey =
  keyof typeof LOCATION_LABELS;

type DayKey =
  (typeof DAYS)[number][0];

type Data = {
  permissions: {
    role: "owner" | "noel" | "david";
    editableRecipients: RecipientKey[];
  };
  settings: {
    leadTimeHours: Record<RecipientKey, number>;
  };
  effectiveDays: Record<
    RecipientKey,
    Record<LocationKey, DayKey[]>
  >;
  defaults: Record<
    RecipientKey,
    Record<LocationKey, DayKey[]>
  >;
  recipients: Record<
    RecipientKey,
    {
      label: string;
      phoneLast4: string;
      manager: boolean;
    }
  >;
  storeHours: Record<
    DayKey,
    { start: string; end: string }
  >;
  smsEnabled: boolean;
};

type Draft = {
  leadTimeHours: Record<RecipientKey, number>;
  effectiveDays: Record<
    RecipientKey,
    Record<LocationKey, DayKey[]>
  >;
};

function cloneDraft(data: Data): Draft {
  return {
    leadTimeHours: {
      ...data.settings.leadTimeHours,
    },
    effectiveDays: {
      noel: {
        "king-of-prussia": [
          ...data.effectiveDays.noel["king-of-prussia"],
        ],
        "cherry-hill": [
          ...data.effectiveDays.noel["cherry-hill"],
        ],
      },
      david: {
        "king-of-prussia": [
          ...data.effectiveDays.david["king-of-prussia"],
        ],
        "cherry-hill": [
          ...data.effectiveDays.david["cherry-hill"],
        ],
      },
      kopTracfone: {
        "king-of-prussia": [
          ...data.effectiveDays.kopTracfone["king-of-prussia"],
        ],
        "cherry-hill": [
          ...data.effectiveDays.kopTracfone["cherry-hill"],
        ],
      },
      chTracfone: {
        "king-of-prussia": [
          ...data.effectiveDays.chTracfone["king-of-prussia"],
        ],
        "cherry-hill": [
          ...data.effectiveDays.chTracfone["cherry-hill"],
        ],
      },
    },
  };
}

function formatClock(value: string) {
  const [hourValue, minute] =
    value.split(":");
  const hour = Number(hourValue);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display}:${minute} ${suffix}`;
}

export default function NotificationAdminClient() {
  const [secret, setSecret] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  async function request(
    method: "GET" | "PATCH",
    body?: unknown
  ) {
    const response = await fetch(
      "/api/admin/notifications",
      {
        method,
        headers: {
          "x-notification-secret": secret,
          ...(body
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body: body
          ? JSON.stringify(body)
          : undefined,
        cache: "no-store",
      }
    );

    const json = await response.json();
    if (!response.ok) {
      throw new Error(
        json.error || "Request failed."
      );
    }
    return json;
  }

  async function login() {
    setError("");
    try {
      const json = await request("GET") as Data;
      setData(json);
      setDraft(cloneDraft(json));
      setDirty(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not sign in."
      );
    }
  }

  function setLeadTime(
    recipient: RecipientKey,
    value: string
  ) {
    if (!draft) return;

    setDraft({
      ...draft,
      leadTimeHours: {
        ...draft.leadTimeHours,
        [recipient]: Number(value),
      },
    });
    setDirty(true);
    setSavedMessage("");
  }

  function toggleDay(
    recipient: RecipientKey,
    location: LocationKey,
    day: DayKey
  ) {
    if (!draft) return;

    const current =
      draft.effectiveDays[recipient][location];
    const days = current.includes(day)
      ? current.filter((value) => value !== day)
      : [...current, day];

    setDraft({
      ...draft,
      effectiveDays: {
        ...draft.effectiveDays,
        [recipient]: {
          ...draft.effectiveDays[recipient],
          [location]: days,
        },
      },
    });
    setDirty(true);
    setSavedMessage("");
  }

  async function saveAll() {
    if (!data || !draft || !dirty || saving) {
      return;
    }

    setSaving(true);
    setError("");
    setSavedMessage("");

    try {
      const editable =
        data.permissions.editableRecipients;

      const leadTimeHours =
        Object.fromEntries(
          editable.map((recipient) => [
            recipient,
            draft.leadTimeHours[recipient],
          ])
        );

      const effectiveDays =
        Object.fromEntries(
          editable.map((recipient) => [
            recipient,
            draft.effectiveDays[recipient],
          ])
        );

      await request("PATCH", {
        action: "saveAll",
        leadTimeHours,
        effectiveDays,
      });

      const refreshed = await request("GET") as Data;
      setData(refreshed);
      setDraft(cloneDraft(refreshed));
      setDirty(false);
      setSavedMessage("Saved");
      window.setTimeout(
        () => setSavedMessage(""),
        1800
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save."
      );
    } finally {
      setSaving(false);
    }
  }

  const editable = useMemo(
    () =>
      new Set(
        data?.permissions.editableRecipients ?? []
      ),
    [data]
  );

  if (!data || !draft) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white sm:px-6 sm:py-14">
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-5 shadow-2xl sm:p-6">
          <h1 className="text-2xl font-semibold">
            Notification Administration
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Enter your notification access code.
          </p>
          <input
            type="password"
            value={secret}
            onChange={(event) =>
              setSecret(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void login();
              }
            }}
            className="mt-4 w-full rounded-lg border border-white/15 bg-black px-4 py-3 outline-none focus:border-white/40"
            autoComplete="current-password"
          />
          <button
            onClick={() => void login()}
            className="mt-3 w-full rounded-lg bg-white px-4 py-3 font-semibold text-black hover:bg-neutral-200"
          >
            Open Notifications
          </button>
          {error ? (
            <p className="mt-3 text-sm text-red-400">
              {error}
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-3 pb-6 text-white sm:px-5">
      <div className="sticky top-0 z-30 -mx-3 border-b border-white/10 bg-neutral-950/95 px-3 py-2.5 backdrop-blur sm:-mx-5 sm:px-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold sm:text-lg">
              Booking Notifications
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-400">
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ${
                  data.smsEnabled
                    ? "bg-green-500/15 text-green-300"
                    : "bg-amber-500/15 text-amber-300"
                }`}
              >
                SMS {data.smsEnabled ? "ON" : "OFF"}
              </span>
              {savedMessage ? (
                <span className="text-green-300">
                  {savedMessage}
                </span>
              ) : dirty ? (
                <span className="text-amber-300">
                  Unsaved changes
                </span>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void saveAll()}
            disabled={!dirty || saving}
            className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-35"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl pt-4">
        <p className="mb-4 text-sm leading-5 text-neutral-400">
          Day changes are temporary. Each day keeps its override until that day ends at midnight Eastern.
        </p>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-2">
          {(Object.keys(data.recipients) as RecipientKey[]).map(
            (recipient) => {
              const info = data.recipients[recipient];
              const canEdit = editable.has(recipient);
              const locations: LocationKey[] =
                recipient === "kopTracfone"
                  ? ["king-of-prussia"]
                  : recipient === "chTracfone"
                    ? ["cherry-hill"]
                    : [
                        "king-of-prussia",
                        "cherry-hill",
                      ];

              return (
                <section
                  key={recipient}
                  className="rounded-xl border border-white/10 bg-neutral-900 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold leading-tight">
                        {info.label}
                      </h2>
                      <p className="mt-1 text-xs text-neutral-500">
                        Phone ending in {info.phoneLast4}
                      </p>
                    </div>
                    {!canEdit ? (
                      <span className="shrink-0 rounded bg-white/5 px-2 py-1 text-xs text-neutral-500">
                        View only
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <label
                      htmlFor={`${recipient}-hours`}
                      className="text-sm font-medium text-neutral-300"
                    >
                      Lead time
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id={`${recipient}-hours`}
                        type="number"
                        min="1"
                        max="168"
                        step="1"
                        value={
                          Number.isFinite(
                            draft.leadTimeHours[recipient]
                          )
                            ? draft.leadTimeHours[recipient]
                            : ""
                        }
                        onChange={(event) =>
                          setLeadTime(
                            recipient,
                            event.target.value
                          )
                        }
                        disabled={!canEdit}
                        className="w-20 rounded-lg border border-white/15 bg-black px-3 py-1.5 text-sm disabled:opacity-50"
                      />
                      <span className="text-xs text-neutral-500">
                        hours
                      </span>
                    </div>
                  </div>

                  {locations.map((location) => (
                    <div
                      key={location}
                      className="mt-3"
                    >
                      <div className="mb-1.5 text-sm font-medium text-neutral-300">
                        {LOCATION_LABELS[location]}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                        {DAYS.map(([day, label]) => {
                          const active =
                            draft.effectiveDays[recipient][location].includes(day);
                          const changed =
                            active !==
                            data.defaults[recipient][location].includes(day);

                          return (
                            <button
                              key={day}
                              type="button"
                              disabled={!canEdit}
                              onClick={() =>
                                toggleDay(
                                  recipient,
                                  location,
                                  day
                                )
                              }
                              className={`min-h-10 rounded-lg border px-2 py-2 text-sm font-medium ${
                                active
                                  ? "border-white/40 bg-white text-black"
                                  : "border-white/10 bg-black text-neutral-500"
                              } ${
                                changed
                                  ? "ring-2 ring-amber-400/50"
                                  : ""
                              } disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </section>
              );
            }
          )}
        </div>

        <section className="mt-3 rounded-xl border border-white/10 bg-neutral-900 p-4">
          <h2 className="text-lg font-semibold">
            Tracfone Store Hours
          </h2>
          <p className="mt-1 text-xs leading-5 text-neutral-400 sm:text-sm">
            Display only. Normal Tracfone alerts send only when the booking is finalized during these hours. Cherry Hill elevator-required alerts override store hours.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
            {DAYS.map(([day, label]) => (
              <div
                key={day}
                className="rounded-lg bg-black px-3 py-2 text-sm"
              >
                <div className="font-medium">
                  {label}
                </div>
                <div className="mt-0.5 text-xs text-neutral-400">
                  {formatClock(data.storeHours[day].start)} - {formatClock(data.storeHours[day].end)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
