export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getRoster } from "@/lib/roster";

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("force") === "true";
  const roster = await getRoster(force);
  return NextResponse.json(roster, { status: roster.error && roster.players.length === 0 ? 500 : 200 });
}
