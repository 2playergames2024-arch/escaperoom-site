export type BookeoBookingPageInfo = {
  totalPages?: number;
  currentPage?: number;
  pageNavigationToken?: string;
};

export type BookeoBookingsPage<T> = {
  data?: T[];
  info?: BookeoBookingPageInfo;
};

type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

const MAX_BOOKEO_RECONCILIATION_PAGES = 100;

export async function fetchAllBookeoBookingPages<T>(
  initialUrl: string,
  apiKey: string,
  secretKey: string,
  timeoutMs: number,
  fetchImpl: FetchLike = fetch
): Promise<{
  ok: boolean;
  status: number;
  bookings: T[];
}> {
  const headers = {
    "X-Bookeo-apiKey": apiKey,
    "X-Bookeo-secretKey": secretKey,
  };

  const firstResponse = await fetchImpl(
    initialUrl,
    {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers,
    }
  );

  const firstData =
    await firstResponse.json() as BookeoBookingsPage<T>;

  if (!firstResponse.ok) {
    return {
      ok: false,
      status: firstResponse.status,
      bookings: [],
    };
  }

  const bookings: T[] =
    Array.isArray(firstData?.data)
      ? [...firstData.data]
      : [];

  const totalPages =
    Number(firstData?.info?.totalPages || 1);

  if (
    !Number.isInteger(totalPages) ||
    totalPages < 1 ||
    totalPages > MAX_BOOKEO_RECONCILIATION_PAGES
  ) {
    return {
      ok: false,
      status: 502,
      bookings: [],
    };
  }

  if (totalPages === 1) {
    return {
      ok: true,
      status: firstResponse.status,
      bookings,
    };
  }

  const pageNavigationToken =
    String(
      firstData?.info?.pageNavigationToken || ""
    ).trim();

  if (!pageNavigationToken) {
    return {
      ok: false,
      status: 502,
      bookings: [],
    };
  }

  for (
    let pageNumber = 2;
    pageNumber <= totalPages;
    pageNumber++
  ) {
    const pageUrl =
      `https://api.bookeo.com/v2/bookings` +
      `?pageNavigationToken=${encodeURIComponent(
        pageNavigationToken
      )}` +
      `&pageNumber=${pageNumber}`;

    const pageResponse =
      await fetchImpl(
        pageUrl,
        {
          method: "GET",
          cache: "no-store",
          signal: AbortSignal.timeout(timeoutMs),
          headers,
        }
      );

    const pageData =
      await pageResponse.json() as BookeoBookingsPage<T>;

    if (!pageResponse.ok) {
      return {
        ok: false,
        status: pageResponse.status,
        bookings: [],
      };
    }

    if (Array.isArray(pageData?.data)) {
      bookings.push(...pageData.data);
    }
  }

  return {
    ok: true,
    status: firstResponse.status,
    bookings,
  };
}
