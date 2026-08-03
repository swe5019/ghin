export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getRoster } from "@/lib/roster";

export async function GET() {
  const roster = await getRoster();
  return NextResponse.json(roster, { status: roster.error && roster.players.length === 0 ? 500 : 200 });
}
