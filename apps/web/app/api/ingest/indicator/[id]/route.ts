import { NextRequest, NextResponse } from "next/server";
// TODO: Implement ingestIndicator or remove this route if not needed
// import { ingestIndicator } from "../../../../../lib/ingest";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  // Stub implementation - route disabled until ingest module is implemented
  return NextResponse.json(
    { success: false, count: 0, error: "Ingest module not implemented" },
    { status: 501 },
  );
}

