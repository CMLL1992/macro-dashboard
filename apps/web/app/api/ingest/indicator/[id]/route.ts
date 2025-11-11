import { NextRequest, NextResponse } from "next/server";
import { ingestIndicator } from "@/lib/ingest";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await ingestIndicator(params.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error ingesting indicator:", error);
    return NextResponse.json(
      { success: false, count: 0, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

