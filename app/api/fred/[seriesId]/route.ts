import { NextRequest } from "next/server";

export async function GET(req: NextRequest, { params }: { params: { seriesId: string } }) {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing FRED_API_KEY" }), { status: 400 });
  }
  const inUrl = new URL(req.url);
  const input = inUrl.searchParams;
  const out = new URLSearchParams({
    series_id: params.seriesId,
    api_key: apiKey,
    file_type: "json",
  });
  const allowed = ["observation_start", "observation_end", "frequency", "units", "limit", "sort_order"];
  for (const k of allowed) {
    const v = input.get(k);
    if (v) out.set(k, v);
  }
  const fredUrl = `https://api.stlouisfed.org/fred/series/observations?${out.toString()}`;
  const r = await fetch(fredUrl, { next: { revalidate: 10800 } });
  if (!r.ok) {
    const text = await r.text();
    return new Response(JSON.stringify({ error: "FRED error", status: r.status, body: text }), { status: 502 });
  }
  const json = await r.json();
  return Response.json(json, { headers: { "Cache-Control": "s-maxage=10800" } });
}


