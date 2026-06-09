// ── Azure OpenAI Client — Embeddings + Chat ───────────────────────────────────
import { AzureOpenAI } from "openai";

function getOpenAIEmbeddingClient(): AzureOpenAI {
  return new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_EMBEDDING_ENDPOINT!,
    apiKey: process.env.AZURE_OPENAI_EMBEDDING_API_KEY!,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
  });
}

function getOpenAIChatClient(): AzureOpenAI {
  return new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_CHAT_ENDPOINT!,
    apiKey: process.env.AZURE_OPENAI_CHAT_API_KEY!,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
  });
}

// ── Generate Embeddings for a batch of text chunks ────────────────────────────
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getOpenAIEmbeddingClient();
  
  // Process in batches of 16 to avoid rate limits
  const BATCH_SIZE = 16;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    
    const response = await client.embeddings.create({
      model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!,
      input: batch,
    });

    const batchEmbeddings = response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);

    allEmbeddings.push(...batchEmbeddings);
    console.log(`✅ Embedded batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)}`);
  }

  return allEmbeddings;
}

// ── Chat Completion with Streaming ───────────────────────────────────────────
export async function createChatStream(
  systemMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
) {
  const client = getOpenAIChatClient();

  const stream = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT!,
    messages: [
      { role: "system", content: systemMessage },
      ...conversationHistory,
    ],
    max_completion_tokens: 1200,
    stream: true,
  });

  return stream;
}
