import "server-only";

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const ACTIVE_TTL_SECONDS = 120;
const TAKEOVER_TTL_SECONDS = 5 * 60;
const RESOLVER_TTL_SECONDS = 5 * 60;

function activeKey(checkoutId: string) {
  return `booking-watchdog:active:${checkoutId}`;
}

function takeoverKey(checkoutId: string) {
  return `booking-watchdog:takeover:${checkoutId}`;
}

function resolverKey(checkoutId: string) {
  return `booking-watchdog:resolver:${checkoutId}`;
}

export async function claimPaymentRouteOwnership(
  checkoutId: string,
  requestId: string
) {
  const claimed = await redis.set(
    activeKey(checkoutId),
    requestId,
    {
      nx: true,
      ex: ACTIVE_TTL_SECONDS,
    }
  );

  return claimed === "OK";
}

export async function releasePaymentRouteOwnership(
  checkoutId: string,
  requestId: string
) {
  if (!checkoutId || !requestId) {
    return;
  }

  const current =
    await redis.get<string>(
      activeKey(checkoutId)
    );

  if (current === requestId) {
    await redis.del(
      activeKey(checkoutId)
    );
  }
}

export async function requestBookingWatchdogTakeover(
  checkoutId: string
) {
  await redis.set(
    takeoverKey(checkoutId),
    "1",
    {
      ex: TAKEOVER_TTL_SECONDS,
    }
  );
}

export async function isBookingWatchdogTakeoverRequested(
  checkoutId: string
) {
  const value =
    await redis.get<string>(
      takeoverKey(checkoutId)
    );

  return value === "1";
}

export async function isPaymentRouteActive(
  checkoutId: string
) {
  return Boolean(
    await redis.get<string>(
      activeKey(checkoutId)
    )
  );
}

export async function waitForPaymentRouteRelease(
  checkoutId: string,
  timeoutMs = 20_000
) {
  const deadline =
    Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (
      !(await isPaymentRouteActive(
        checkoutId
      ))
    ) {
      return true;
    }

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 250)
    );
  }

  return !(
    await isPaymentRouteActive(
      checkoutId
    )
  );
}

export async function clearBookingWatchdogTakeover(
  checkoutId: string
) {
  await redis.del(
    takeoverKey(checkoutId)
  );
}

export async function claimBookingWatchdogResolver(
  checkoutId: string,
  requestId: string
) {
  const claimed = await redis.set(
    resolverKey(checkoutId),
    requestId,
    {
      nx: true,
      ex: RESOLVER_TTL_SECONDS,
    }
  );

  return claimed === "OK";
}

export async function releaseBookingWatchdogResolver(
  checkoutId: string,
  requestId: string
) {
  if (!checkoutId || !requestId) {
    return;
  }

  const current =
    await redis.get<string>(
      resolverKey(checkoutId)
    );

  if (current === requestId) {
    await redis.del(
      resolverKey(checkoutId)
    );
  }
}
