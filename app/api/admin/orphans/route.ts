import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export async function GET(request: Request) {
  try {
    const adminSecret = process.env.ADMIN_RECOVERY_SECRET;

    if (!adminSecret) {
      console.error("ADMIN_RECOVERY_SECRET is not configured.");

      return NextResponse.json(
        { error: "Recovery administration is not configured." },
        { status: 500 }
      );
    }

    const suppliedSecret = request.headers.get("x-admin-secret");

    if (suppliedSecret !== adminSecret) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const keys = await redis.keys("orphan-payment:*");

    if (!keys || keys.length === 0) {
      return NextResponse.json({
        count: 0,
        orphans: [],
      });
    }

    const orphans = await redis.mget(...keys);

    const result = keys.map((key, i) => ({
      key,
      data: orphans[i],
    }));

    return NextResponse.json({
      count: result.length,
      orphans: result,
    });
  } catch (error) {
    console.error("LIST ORPHANS ERROR:", error);

    return NextResponse.json(
      { error: "Could not list orphan payments." },
      { status: 500 }
    );
  }
}