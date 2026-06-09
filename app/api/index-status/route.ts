// ── TASK 4: Index Status Polling Endpoint ────────────────────────────────────
// Frontend polls this every 2 seconds to get the current indexing status
import { NextRequest, NextResponse } from "next/server";
import { indexingJobs } from "../upload/route";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const job = indexingJobs.get(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(job);
}
