// ── TASK 4: Async Indexing API with Job Tracking ─────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { SearchClient, AzureKeyCredential } from "@azure/search-documents";
import { chunkDocument } from "@/lib/chunker";
import { generateEmbeddings } from "@/lib/azure-openai";
import { createSearchIndex, MedVivaDocument } from "@/lib/azure-search";

export const runtime = "nodejs";
export const maxDuration = 300; // Allow up to 5 min for large PDFs

// ── In-memory job store (use Redis/KV store in production) ───────────────────
// Exported so the status route can import it
export const indexingJobs = new Map<
  string,
  {
    status: "processing" | "ready" | "error";
    progress: number;             // 0–100
    message: string;
    filename?: string;
    chunkCount?: number;
    error?: string;
  }
>();

// ── POST /api/upload — Accepts a PDF file and kicks off async indexing ────────
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const topic = (formData.get("topic") as string) || "General";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    if (file.size > 200 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 200MB." },
        { status: 400 }
      );
    }

    // Create a unique job ID for this upload
    const jobId = crypto.randomUUID();
    indexingJobs.set(jobId, {
      status: "processing",
      progress: 0,
      message: "Uploading file...",
      filename: file.name,
    });

    // ── Read file buffer BEFORE the async job starts ──────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── Start the indexing job WITHOUT awaiting it ────────────────────────────
    // This returns the jobId immediately to the frontend
    runIndexingJob(buffer, file.name, topic, jobId).catch((err) => {
      console.error("Indexing job failed:", err);
      indexingJobs.set(jobId, {
        status: "error",
        progress: 0,
        message: "Indexing failed",
        error: err.message,
        filename: file.name,
      });
    });

    // Return the jobId immediately — frontend will poll for status
    return NextResponse.json({
      jobId,
      status: "processing",
      message: "File received. Indexing started.",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// ── ASYNC INDEXING PIPELINE ───────────────────────────────────────────────────
async function runIndexingJob(
  buffer: Buffer,
  filename: string,
  topic: string,
  jobId: string
): Promise<void> {
  const updateJob = (progress: number, message: string) => {
    const current = indexingJobs.get(jobId)!;
    indexingJobs.set(jobId, { ...current, progress, message });
  };

  // Step 1: Ensure the search index exists
  updateJob(5, "Initializing knowledge base...");
  await createSearchIndex();

  // Step 2: Extract text + chunk the document
  updateJob(15, "Reading and chunking document...");
  const chunks = await chunkDocument(buffer, filename, topic, 1000, 100);
  updateJob(35, `Document split into ${chunks.length} knowledge chunks...`);

  // Step 3: Generate embeddings for all chunks
  updateJob(40, "Generating AI embeddings...");
  const texts = chunks.map((c) => c.content);
  const embeddings = await generateEmbeddings(texts);
  updateJob(70, "Embeddings generated. Uploading to knowledge base...");

  // Step 4: Upload all chunks + embeddings to Azure AI Search
  const searchClient = new SearchClient<MedVivaDocument>(
    process.env.AZURE_SEARCH_ENDPOINT!,
    process.env.AZURE_SEARCH_INDEX_NAME!,
    new AzureKeyCredential(process.env.AZURE_SEARCH_API_KEY!)
  );

  // Upload in batches of 100 (Azure Search limit per batch)
  const BATCH_SIZE = 100;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batchChunks = chunks.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = embeddings.slice(i, i + BATCH_SIZE);

    const documents: MedVivaDocument[] = batchChunks.map((chunk, idx) => ({
      id: `${filename.replace(/[^a-zA-Z0-9]/g, "_")}_chunk_${chunk.chunkIndex}`,
      content: chunk.content,
      filename: chunk.filename,
      pageNumber: chunk.approximatePage,
      topic: chunk.topic,
      chunkIndex: chunk.chunkIndex,
      contentVector: batchEmbeddings[idx],
    }));

    await searchClient.uploadDocuments(documents);

    const uploadProgress = 70 + Math.floor(((i + BATCH_SIZE) / chunks.length) * 25);
    updateJob(
      Math.min(uploadProgress, 95),
      `Indexed ${Math.min(i + BATCH_SIZE, chunks.length)} of ${chunks.length} chunks...`
    );
  }

  // Done!
  indexingJobs.set(jobId, {
    status: "ready",
    progress: 100,
    message: `"${filename}" is now in your knowledge base and ready for viva questions!`,
    filename,
    chunkCount: chunks.length,
  });

  console.log(`✅ Indexing complete: ${filename} → ${chunks.length} chunks`);
}
