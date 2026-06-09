// ── TASK 3: Recursive Character Text Splitter with 10% Overlap ───────────────
// Mirrors LangChain's RecursiveCharacterTextSplitter behavior.
// Preserves semantic context across chunk boundaries via overlap.

export interface ChunkMetadata {
  content: string;
  chunkIndex: number;
  charStart: number;
  charEnd: number;
  approximatePage: number;    // Estimated page number (250 words/page heuristic)
}

// ── CORE SPLITTER ─────────────────────────────────────────────────────────────
export function recursiveCharacterTextSplitter(
  text: string,
  chunkSize: number = 1000,   // characters per chunk
  chunkOverlap: number = 100, // 10% overlap = 100 chars for chunkSize 1000
  separators: string[] = ["\n\n", "\n", ". ", "! ", "? ", " ", ""]
): ChunkMetadata[] {
  const rawChunks = splitRecursive(text, separators, chunkSize, chunkOverlap);
  
  // Attach metadata to each chunk
  let charCursor = 0;
  return rawChunks.map((content, idx) => {
    const charStart = text.indexOf(content, charCursor);
    const charEnd = charStart + content.length;
    charCursor = charEnd - chunkOverlap; // rewind cursor by overlap amount

    // Heuristic: ~250 words per page, ~5 chars per word = 1250 chars/page
    const approximatePage = Math.max(1, Math.ceil(charStart / 1250));

    return { content, chunkIndex: idx, charStart, charEnd, approximatePage };
  });
}

// ── RECURSIVE SPLITTING LOGIC ─────────────────────────────────────────────────
function splitRecursive(
  text: string,
  separators: string[],
  chunkSize: number,
  chunkOverlap: number
): string[] {
  // Base case: text fits in a single chunk
  if (text.length <= chunkSize) {
    return text.trim() ? [text.trim()] : [];
  }

  // Try each separator in priority order
  for (const separator of separators) {
    const splits = separator ? text.split(separator) : text.split("");

    if (splits.length <= 1) continue; // this separator doesn't split — try next

    const chunks: string[] = [];
    let currentChunk = "";

    for (let i = 0; i < splits.length; i++) {
      const piece = splits[i];
      const joined = currentChunk
        ? currentChunk + separator + piece
        : piece;

      if (joined.length <= chunkSize) {
        // Still fits — keep accumulating
        currentChunk = joined;
      } else {
        if (currentChunk) {
          // Save the current chunk
          chunks.push(currentChunk.trim());

          // ── OVERLAP: carry the tail of the previous chunk into the next ──
          const overlapText = getOverlapSuffix(currentChunk, chunkOverlap);
          currentChunk = overlapText
            ? overlapText + separator + piece
            : piece;
        } else {
          // Single piece is too large — recurse with next separator
          const subChunks = splitRecursive(
            piece,
            separators.slice(separators.indexOf(separator) + 1),
            chunkSize,
            chunkOverlap
          );
          chunks.push(...subChunks);
          currentChunk = "";
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // If we successfully split, return — don't try more separators
    if (chunks.length > 1) {
      return chunks.filter((c) => c.length > 0);
    }
  }

  // Fallback: hard-split by chunkSize with overlap
  return hardSplit(text, chunkSize, chunkOverlap);
}

// ── OVERLAP HELPER: extract last N chars from previous chunk ──────────────────
function getOverlapSuffix(text: string, overlapSize: number): string {
  if (overlapSize <= 0 || text.length <= overlapSize) return text;
  
  // Try to break at a word boundary within the overlap region
  const suffix = text.slice(-overlapSize);
  const firstSpace = suffix.indexOf(" ");
  return firstSpace > 0 ? suffix.slice(firstSpace + 1) : suffix;
}

// ── HARD SPLIT FALLBACK ───────────────────────────────────────────────────────
function hardSplit(
  text: string,
  chunkSize: number,
  chunkOverlap: number
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end).trim());
    start += chunkSize - chunkOverlap;
  }

  return chunks.filter((c) => c.length > 0);
}

// ── PDF TEXT EXTRACTION ───────────────────────────────────────────────────────
// Uses unpdf — built for serverless/Node.js, no canvas or workers needed
export async function extractTextWithPages(
  buffer: Buffer,
  filename: string
): Promise<{ fullText: string; pages: string[] }> {
  const { extractText } = await import("unpdf");

  const result = await extractText(new Uint8Array(buffer), { mergePages: false });

  const pages: string[] = (result.text as unknown as string[])
    .map((p: string) => p.trim())
    .filter((p: string) => p.length > 0);

  const fullText = pages.join("\n\n");
  console.log(`✅ Extracted ${pages.length} pages from ${filename} (${fullText.length} chars)`);
  return { fullText, pages };
}



// ── INGESTION PIPELINE ENTRY POINT ───────────────────────────────────────────
// Call this when a user uploads a file to chunk it with full metadata
export async function chunkDocument(
  buffer: Buffer,
  filename: string,
  topic: string,
  chunkSize: number = 1000,
  chunkOverlap: number = 100
): Promise<Array<ChunkMetadata & { filename: string; topic: string }>> {
  const { pages } = await extractTextWithPages(buffer, filename);

  const allChunks: Array<ChunkMetadata & { filename: string; topic: string }> = [];
  let globalChunkIndex = 0;

  // Process page by page for accurate page number tracking
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const pageText = pages[pageIdx];
    if (!pageText.trim()) continue;

    const pageChunks = recursiveCharacterTextSplitter(
      pageText,
      chunkSize,
      chunkOverlap
    );

    for (const chunk of pageChunks) {
      allChunks.push({
        ...chunk,
        chunkIndex: globalChunkIndex++,
        approximatePage: pageIdx + 1, // Use actual page number from PDF
        filename,
        topic,
      });
    }
  }

  console.log(`✅ Document "${filename}" chunked into ${allChunks.length} pieces.`);
  return allChunks;
}
