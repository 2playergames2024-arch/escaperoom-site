"use client";

import { useState } from "react";

type OrphanData = {
  sessionId?: string;
  transactionId?: string;
  amount?: string;
  holdId?: string;
  productId?: string;
  eventId?: string;
  players?: string;
  location?: string;
  date?: string;
  time?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  createdAt?: number;
  status?: string;
  failureType?: string;
  lastReconciliationResult?: string;
  lastReconciledAt?: number;
  reconciledBookingNumber?: string;
  recoveredBookingNumber?: string;
};

type OrphanRecord = {
  key: string;
  data: OrphanData | null;
};

export default function AdminOrphansClient() {
  const [secret, setSecret] =
    useState("");

  const [orphans, setOrphans] =
    useState<OrphanRecord[]>([]);

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [hasLoaded, setHasLoaded] =
    useState(false);

  async function loadOrphans() {
    if (!secret.trim()) {
      setError(
        "Enter the recovery administration secret."
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/orphans",
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "x-admin-secret":
              secret.trim(),
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not load recovery records."
        );
      }

      setOrphans(
        Array.isArray(data.orphans)
          ? data.orphans
          : []
      );

      setHasLoaded(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load recovery records."
      );
    } finally {
      setLoading(false);
    }
  }

  const unresolved =
    orphans.filter(
      (record) =>
        record.data?.status ===
        "needs_recovery"
    );

  const resolved =
    orphans.filter(
      (record) =>
        record.data?.status !==
        "needs_recovery"
    );

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <section className="mx-auto max-w-6xl">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">
          Staff Administration
        </p>

        <h1 className="mt-2 text-4xl font-black">
          Booking Recovery
        </h1>

        <p className="mt-4 max-w-3xl text-slate-300">
          This page shows payments that may
          require manual booking recovery.
          It is intentionally read-only.
        </p>

        <div className="mt-8 max-w-xl rounded-xl border border-slate-700 bg-slate-900 p-6">
          <label
            htmlFor="admin-secret"
            className="block font-bold"
          >
            Recovery administration secret
          </label>

          <input
            id="admin-secret"
            type="password"
            value={secret}
            onChange={(event) =>
              setSecret(
                event.target.value
              )
            }
            autoComplete="off"
            className="mt-3 w-full rounded border border-slate-600 bg-slate-950 px-4 py-3 text-white"
          />

          <button
            type="button"
            onClick={loadOrphans}
            disabled={loading}
            className="mt-4 rounded bg-orange-500 px-6 py-3 font-black uppercase text-white hover:bg-orange-600 disabled:bg-slate-600"
          >
            {loading
              ? "Loading..."
              : "Load Recovery Records"}
          </button>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded bg-red-950 p-3 font-bold text-red-200"
            >
              {error}
            </p>
          )}
        </div>

        {hasLoaded && (
          <>
            <section className="mt-10">
              <div className="flex flex-wrap items-center gap-4">
                <h2 className="text-2xl font-black">
                  Needs Attention
                </h2>

                <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-black">
                  {unresolved.length}
                </span>
              </div>

              {unresolved.length ===
              0 ? (
                <div className="mt-5 rounded-xl border border-green-700 bg-green-950 p-6">
                  <p className="font-black text-green-200">
                    No unresolved booking
                    recovery records.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-5">
                  {unresolved.map(
                    (record) => (
                      <RecoveryCard
                        key={record.key}
                        record={record}
                      />
                    )
                  )}
                </div>
              )}
            </section>

            {resolved.length > 0 && (
              <section className="mt-12">
                <h2 className="text-2xl font-black">
                  Resolved / Historical
                </h2>

                <div className="mt-5 grid gap-5">
                  {resolved.map(
                    (record) => (
                      <RecoveryCard
                        key={record.key}
                        record={record}
                      />
                    )
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function RecoveryCard({
  record,
}: {
  record: OrphanRecord;
}) {
  const orphan =
    record.data || {};

  const created =
    orphan.createdAt
      ? new Date(
          orphan.createdAt
        ).toLocaleString()
      : "Unknown";

  return (
    <article className="rounded-xl border border-slate-700 bg-slate-900 p-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase text-orange-400">
            {orphan.status ||
              "Unknown status"}
          </p>

          <h3 className="mt-1 text-xl font-black">
            {orphan.firstName || ""}{" "}
            {orphan.lastName || ""}
          </h3>
        </div>

        <div className="text-right">
          <p className="font-black">
            {orphan.amount
              ? `$${orphan.amount}`
              : "Amount unknown"}
          </p>

          <p className="text-sm text-slate-400">
            {created}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 text-sm md:grid-cols-2">
        <p>
          <strong>Location:</strong>{" "}
          {orphan.location || "—"}
        </p>

        <p>
          <strong>Date:</strong>{" "}
          {orphan.date || "—"}
        </p>

        <p>
          <strong>Time:</strong>{" "}
          {orphan.time || "—"}
        </p>

        <p>
          <strong>Players:</strong>{" "}
          {orphan.players || "—"}
        </p>

        <p>
          <strong>Email:</strong>{" "}
          {orphan.email || "—"}
        </p>

        <p>
          <strong>Phone:</strong>{" "}
          {orphan.phone || "—"}
        </p>

        <p>
          <strong>Failure type:</strong>{" "}
          {orphan.failureType || "—"}
        </p>

        <p>
          <strong>Transaction:</strong>{" "}
          {orphan.transactionId || "—"}
        </p>

        <p className="md:col-span-2 break-all">
          <strong>Session:</strong>{" "}
          {orphan.sessionId || "—"}
        </p>

        {orphan.lastReconciliationResult && (
          <p className="md:col-span-2">
            <strong>
              Last reconciliation:
            </strong>{" "}
            {
              orphan.lastReconciliationResult
            }
          </p>
        )}
      </div>
    </article>
  );
}