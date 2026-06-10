"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./viva.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Citation {
  filename: string;
  pageNumber: number;
  citation: string;
}

interface Message {
  id: string;
  role: "ai" | "user";
  content: string;
  time: string;
  score?: "correct" | "partial" | "wrong";
  citations?: Citation[];
  isStreaming?: boolean;
  mcqState?: {
    correct: string;
    explanation: string;
    answered?: string;
  };
}

interface UploadJob {
  jobId: string;
  status: "processing" | "ready" | "error";
  progress: number;
  message: string;
  filename?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TOPICS = [
  { icon: "🫀", label: "Anatomy" },
  { icon: "🫁", label: "Physiology" },
  { icon: "🧬", label: "Biochemistry" },
  { icon: "🔬", label: "Pathology" },
  { icon: "💊", label: "Pharmacology" },
  { icon: "🧫", label: "Microbiology" },
  { icon: "⚖️", label: "Forensic Medicine (FMT)" },
  { icon: "🌍", label: "Social & Preventive Medicine (SPM)" },
  { icon: "🩺", label: "General Medicine" },
  { icon: "🔪", label: "General Surgery" },
  { icon: "🤰", label: "Obstetrics & Gynaecology (OBG)" },
  { icon: "👶", label: "Pediatrics" },
  { icon: "👂", label: "ENT" },
  { icon: "👁️", label: "Ophthalmology" },
  { icon: "🦴", label: "Orthopedics" },
  { icon: "🩻", label: "Radiology" },
  { icon: "😴", label: "Anesthesia" },
  { icon: "🧴", label: "Dermatology" },
  { icon: "🧠", label: "Psychiatry" },
];

function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function uuid() {
  return crypto.randomUUID();
}

// ── BONUS: Web Speech API Utilities ──────────────────────────────────────────
function isSpeechRecognitionSupported(): boolean {
  return typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

function getSpeechRecognition(): SpeechRecognition | null {
  if (!isSpeechRecognitionSupported()) return null;
  const SpeechRecognitionClass =
    (window as Window & typeof globalThis & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
    (window as Window & typeof globalThis & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
  if (!SpeechRecognitionClass) return null;
  const recognition = new SpeechRecognitionClass();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  return recognition;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VivaPage() {
  // State
  const [appMode, setAppMode] = useState<"viva" | "mcq">("viva");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, partial: 0, wrong: 0, total: 0 });
  const [uploadJob, setUploadJob] = useState<UploadJob | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Set mounted = true after first client render (fixes SSR hydration)
  useEffect(() => { setMounted(true); }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Persistent Session Save ────────────────────────────────────────────────
  useEffect(() => {
    if (activeTopic && mounted) {
      const stateToSave = {
        messages,
        score,
        uploadJob,
        conversationHistory,
        appMode
      };
      localStorage.setItem(`medviva-topic-${activeTopic}`, JSON.stringify(stateToSave));
    }
  }, [activeTopic, mounted, messages, score, uploadJob, conversationHistory, appMode]);

  // ── TASK 5: Start a new session for a topic ───────────────────────────────
  const startTopic = useCallback(async (topic: string, forceNew = false) => {
    // Abort any in-flight request
    abortControllerRef.current?.abort();

    setActiveTopic(topic);

    let currentUploadJob = uploadJob;

    if (!forceNew && mounted) {
      const savedState = localStorage.getItem(`medviva-topic-${topic}`);
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          setMessages(parsed.messages || []);
          setConversationHistory(parsed.conversationHistory || []);
          setScore(parsed.score || { correct: 0, partial: 0, wrong: 0, total: 0 });
          setUploadJob(parsed.uploadJob || null);
          currentUploadJob = parsed.uploadJob || null;
          setAppMode(parsed.appMode || "viva");
          setIsStreaming(false);
          return; // Exit early, we loaded existing state
        } catch (e) {
          console.error("Failed to parse saved state", e);
        }
      } else {
        // If switching topics but no saved state, clear uploadJob
        setUploadJob(null);
        currentUploadJob = null;
      }
    }

    setMessages([]);
    setConversationHistory([]);
    setScore({ correct: 0, partial: 0, wrong: 0, total: 0 });
    setIsStreaming(true);

    // Create the "Professor Mode" opening prompt
    const openingPrompt = appMode === "mcq"
      ? `Generate a multiple-choice question on ${topic} using the specified schema format.`
      : `Start a viva session on ${topic}. Present a clinical scenario and ask me one focused question. Do NOT reveal the answer.`;

    const history: Message[] = [{
      id: Date.now().toString(),
      role: "user",
      content: openingPrompt,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }];

    // Call the real API
    // eslint-disable-next-line react-hooks/exhaustive-deps
    await streamChatResponse(history, topic, true, currentUploadJob?.filename);
  }, [appMode, uploadJob?.filename]);

  // ── TASK 1 + 5: Stream chat from the grounded RAG API ────────────────────
  const streamChatResponse = useCallback(
    async (
      history: Array<{ role: "user" | "assistant"; content: string }>,
      topic: string | null,
      isOpening = false,
      filenameOverride?: string
    ) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Add a streaming placeholder message
      const streamingId = uuid();
      setMessages((prev) => [
        ...prev,
        {
          id: streamingId,
          role: "ai",
          content: "",
          time: getTime(),
          isStreaming: true,
        },
      ]);

      let fullContent = "";
      let citations: Citation[] = [];

      try {
        const activeFilename = filenameOverride !== undefined ? filenameOverride : uploadJob?.filename;

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, topic, mode: appMode, filename: activeFilename }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);
        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          
          // The last element is either an empty string (if the chunk ended in \n) 
          // or a partial line. We keep it in the buffer for the next read.
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.replace("data: ", "").trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);

              if (data.content) {
                fullContent += data.content;
                // Update the streaming message in-place
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === streamingId
                      ? { ...m, content: fullContent }
                      : m
                  )
                );
              }

              if (data.done) {
                if (data.citations) {
                  citations = data.citations;
                }
              }
            } catch {
              // Ignore malformed SSE lines that might occasionally slip through
            }
          }
        }

        // Parse MCQ Tags
        let finalContent = fullContent;
        let mcqState: Message["mcqState"];

        const correctMatch = finalContent.match(/<correct>\s*([A-D])\s*<\/correct>/i);
        const explanationMatch = finalContent.match(/<explanation>([\s\S]*?)<\/explanation>/i);

        if (correctMatch) {
          mcqState = {
            correct: correctMatch[1].toUpperCase(),
            explanation: explanationMatch?.[1].trim() || "",
          };
          finalContent = finalContent
            .replace(/<correct>[\s\S]*?<\/correct>/gi, "")
            .replace(/<explanation>[\s\S]*?<\/explanation>/gi, "")
            .trim();
        }

        // Detect score from response content
        let score: Message["score"];
        if (/CORRECT\s*✓/i.test(finalContent)) score = "correct";
        else if (/PARTIAL\s*◑/i.test(finalContent)) score = "partial";
        else if (/INCORRECT\s*✗/i.test(finalContent)) score = "wrong";

        if (score) {
          setScore((prev) => ({
            ...prev,
            [score!]: prev[score!] + 1,
            total: prev.total + 1,
          }));
        }

        // Finalize the message (remove streaming flag, add citations)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingId
              ? { ...m, content: finalContent, isStreaming: false, score, mcqState, citations: citations.length > 0 ? citations : undefined }
              : m
          )
        );

        // Update conversation history for multi-turn context
        // Use finalContent (cleaned, XML tags stripped) to prevent JSON
        // serialization errors on subsequent turns caused by raw <correct>/<explanation> tags.
        setConversationHistory((prev) => [
          ...prev,
          { role: "assistant", content: finalContent || fullContent },
        ]);

        // BONUS: TTS — read the AI response aloud if voice mode is on
        if (voiceMode && fullContent) {
          speakText(fullContent);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingId
              ? { ...m, content: "Connection error. Please try again.", isStreaming: false }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [voiceMode, appMode, uploadJob?.filename]
  );

  // ── Send User Answer ──────────────────────────────────────────────────────
  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = typeof overrideText === "string" ? overrideText : input.trim();
    if (!text || isStreaming || !activeTopic) return;

    setInput("");

    // Add user message to UI
    const userMsg: Message = { id: uuid(), role: "user", content: text, time: getTime() };
    setMessages((prev) => [...prev, userMsg]);

    // Build updated history
    const updatedHistory = [
      ...conversationHistory,
      { role: "user" as const, content: text },
    ];
    setConversationHistory(updatedHistory);

    setIsStreaming(true);
    await streamChatResponse(updatedHistory, activeTopic);
  }, [input, isStreaming, activeTopic, conversationHistory, streamChatResponse]);

  // ── Handle Enter key ─────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── TASK 4: File Upload + Async Indexing ──────────────────────────────────
  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith(".pdf")) {
      alert("Only PDF files are supported.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("topic", activeTopic || "General");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Upload failed.");
        return;
      }

      setUploadJob({
        jobId: data.jobId,
        status: "processing",
        progress: 0,
        message: "Uploading...",
        filename: file.name,
      });

      // ── TASK 4: Start polling every 2 seconds ─────────────────────────────
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/index-status?jobId=${data.jobId}`);
          const status = await statusRes.json();

          setUploadJob((prev) =>
            prev ? { ...prev, ...status } : prev
          );

          if (status.status === "ready" || status.status === "error") {
            clearInterval(pollingRef.current!);
          }
        } catch {
          clearInterval(pollingRef.current!);
        }
      }, 2000);
    } catch {
      alert("Upload failed. Please try again.");
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ── BONUS: Web Speech API — Speech-to-Text ────────────────────────────────
  const toggleListening = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      alert("Voice input is not supported in this browser. Please use Chrome.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = getSpeechRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      setInput(transcript);

      // If final result, auto-send
      if (event.results[event.results.length - 1].isFinal) {
        setTimeout(() => {
          sendMessage();
        }, 500);
      }
    };

    recognition.start();
  }, [isListening, sendMessage]);

  // ── BONUS: Text-to-Speech for AI responses ────────────────────────────────
  const speakText = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      // Strip markdown symbols for cleaner speech
      text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/#+\s/g, "")
    );
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  };

  const accuracy =
    score.total > 0
      ? Math.round(((score.correct + score.partial * 0.5) / score.total) * 100)
      : 0;

  // ── Mastery Matrix Calculation ──────────────────────────────────────────
  const TARGET_QUESTIONS = 20;
  const progressPercent = Math.min(100, Math.round((score.total / TARGET_QUESTIONS) * 100));

  let readinessText = "";
  let isWarning = false;

  if (score.total === 0) {
    readinessText = "Not Started";
  } else if (accuracy < 60) {
    readinessText = "Review Needed: Accuracy too low for board competency.";
    isWarning = true;
  } else if (progressPercent <= 25) {
    readinessText = "Initialization — Building Clinical Foundation";
  } else if (progressPercent <= 50) {
    readinessText = "Intermediate — Patching Conceptual Gaps";
  } else if (progressPercent <= 75) {
    readinessText = "Advanced — High-Yield Competency Achieved";
  } else {
    readinessText = "Board Ready — Core Material Fully Audited";
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.layout}>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link href="/" className={styles.sidebarLogo}>
            <div className={styles.sidebarLogoIcon}>🧬</div>
            <span className={styles.sidebarLogoText}>MedViva AI</span>
          </Link>
          <button
            id="new-session-btn"
            className={styles.newSessionBtn}
            onClick={() => {
              abortControllerRef.current?.abort();
              if (activeTopic) {
                // Wipe session data but preserve the uploaded document
                const preservedState = {
                  messages: [],
                  score: { correct: 0, partial: 0, wrong: 0, total: 0 },
                  uploadJob: uploadJob,
                  conversationHistory: [],
                  appMode: appMode
                };
                localStorage.setItem(`medviva-topic-${activeTopic}`, JSON.stringify(preservedState));
                startTopic(activeTopic, true);
              } else {
                setMessages([]);
                setActiveTopic(null);
                setConversationHistory([]);
                setScore({ correct: 0, partial: 0, wrong: 0, total: 0 });
                // We keep uploadJob here just in case, or null it out if you want a true reset when no topic is selected.
                setUploadJob(null);
              }
            }}
          >
            + New Session
          </button>
          
          {/* Mode Toggle */}
          <div className={styles.modeToggle}>
            <button
              className={`${styles.modeBtn} ${appMode === "viva" ? styles.modeBtnActive : ""}`}
              onClick={() => setAppMode("viva")}
            >
              Viva Mode
            </button>
            <button
              className={`${styles.modeBtn} ${appMode === "mcq" ? styles.modeBtnActive : ""}`}
              onClick={() => setAppMode("mcq")}
            >
              MCQ Mode
            </button>
          </div>
        </div>

        <div className={styles.sidebarSection}>Topics</div>
        <div className={styles.sidebarTopics}>
          {TOPICS.map((t) => (
            <button
              key={t.label}
              id={`topic-${t.label.toLowerCase().replace(/\s/g, "-")}`}
              className={`${styles.topicBtn} ${activeTopic === t.label ? styles.topicBtnActive : ""}`}
              onClick={() => startTopic(t.label)}
              disabled={isStreaming}
            >
              <span className={styles.topicIcon}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TASK 4: Upload Area with Progress ────────────────────────── */}
        <div className={styles.sidebarFooter}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            style={{ display: "none" }}
            id="file-upload-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = "";
            }}
          />
          {uploadJob && uploadJob.status !== "ready" ? (
            <div className={styles.uploadProgress}>
              <div className={styles.uploadProgressHeader}>
                <span className={styles.uploadProgressIcon}>
                  {uploadJob.status === "error" ? "❌" : "⚙️"}
                </span>
                <span className={styles.uploadProgressName}>
                  {uploadJob.filename?.slice(0, 24)}...
                </span>
              </div>
              <div className={styles.uploadProgressBar}>
                <div
                  className={styles.uploadProgressFill}
                  style={{ width: `${uploadJob.progress}%` }}
                />
              </div>
              <div className={styles.uploadProgressMsg}>{uploadJob.message}</div>
            </div>
          ) : uploadJob?.status === "ready" ? (
            <div className={styles.uploadReady}>
              <span>✅</span>
              <span>{uploadJob.filename} is ready!</span>
            </div>
          ) : (
            <div className={styles.uploadAreaContainer} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                className={styles.uploadArea}
                id="upload-area"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
                }}
              >
                <div className={styles.uploadIcon}>📄</div>
                <div className={styles.uploadText}>
                  <span className={styles.uploadTextBold}>Upload your notes</span>
                  <br />
                  PDF only · Max 200MB · Drag & drop
                </div>
              </div>

              {/* Demo Action Area */}
              <div style={{ textAlign: "center", padding: "16px", background: "rgba(99, 102, 241, 0.05)", borderRadius: "var(--radius-lg)", border: "1px solid rgba(99, 102, 241, 0.15)" }}>
                <button
                  className={styles.newSessionBtn}
                  style={{ background: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.3)", color: "#10b981", width: "100%", marginBottom: "12px" }}
                  onClick={() => {
                    setUploadJob({
                      jobId: "demo-job",
                      status: "ready",
                      progress: 100,
                      message: "Demo text successfully loaded into memory.",
                      filename: "High-Yield-Pathology-Demo.pdf"
                    });
                  }}
                >
                  🚀 Launch Quick Demo (Pre-Loaded)
                </button>
                <a 
                  href="/demo-assets/High-Yield-Pathology-Demo.pdf" 
                  download 
                  style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", textDecoration: "underline" }}
                >
                  Don't have a textbook handy? Download our 1-MB Sample PDF.
                </a>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Chat Area ───────────────────────────────────────────────── */}
      <main className={styles.main}>
        <div className={styles.chatHeader}>
          <div className={styles.chatHeaderLeft}>
            <div className={styles.chatHeaderIcon}>🤖</div>
            <div>
              <div className={styles.chatHeaderName}>
                {activeTopic ? `${activeTopic} Examiner` : "MedViva AI Examiner"}
              </div>
              <div className={styles.chatHeaderSub}>
                <span className={styles.statusDot} />
                {isStreaming
                  ? "Thinking..."
                  : activeTopic
                  ? `Active — ${activeTopic} session`
                  : "Ready to begin your viva"}
              </div>
            </div>
          </div>
          <div className={styles.chatHeaderRight}>
            {/* BONUS: Voice Mode Toggle */}
            <button
              id="voice-mode-btn"
              className={`${styles.headerBtn} ${voiceMode ? styles.headerBtnActive : ""}`}
              onClick={() => setVoiceMode((v) => !v)}
              title="Toggle voice mode (AI reads responses aloud)"
            >
              {voiceMode ? "🔊 Voice On" : "🔇 Voice Off"}
            </button>
            <button
              id="end-session-btn"
              className={styles.headerBtn}
              onClick={() => {
                abortControllerRef.current?.abort();
                setMessages([]);
                setActiveTopic(null);
                setConversationHistory([]);
              }}
            >
              End Session
            </button>
          </div>
        </div>

        {/* ── Messages ──────────────────────────────────────────────────── */}
        <div className={styles.messages}>
          {messages.length === 0 ? (
            <div className={styles.welcome}>
              <div className={styles.welcomeIcon}>🧬</div>
              <h1 className={styles.welcomeTitle}>
                {activeTopic ? `${activeTopic} Viva` : "Ready to Begin?"}
              </h1>
              <p className={styles.welcomeSubtitle}>
                {activeTopic
                  ? "Your examiner is preparing the first clinical scenario..."
                  : "Select a topic from the sidebar to start your viva. Upload your textbook PDF first for grounded, cited responses."}
              </p>
              {!activeTopic && (
                <div className={styles.quickTopicsGrid}>
                  {TOPICS.map((t) => (
                    <button
                      key={t.label}
                      className={styles.quickTopicBtn}
                      id={`quick-${t.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                      onClick={() => startTopic(t.label)}
                    >
                      <span className={styles.quickTopicIcon}>{t.icon}</span>
                      <span className={styles.quickTopicLabel}>{t.label} Practice</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`${styles.message} ${msg.role === "user" ? styles.messageUser : ""}`}
              >
                <div
                  className={`${styles.avatar} ${
                    msg.role === "ai" ? styles.avatarAi : styles.avatarUser
                  }`}
                >
                  {msg.role === "ai" ? "🤖" : "You"}
                </div>
                <div className={styles.messageContent}>
                  <div
                    className={`${styles.messageBubble} ${
                      msg.role === "ai"
                        ? styles.messageBubbleAi
                        : styles.messageBubbleUser
                    }`}
                  >
                    {/* Render with line breaks preserved and simple bold parsing */}
                    {msg.content
                      .replace(/<correct>[\s\S]*?(?:<\/correct>|$)/gi, "")
                      .replace(/<explanation>[\s\S]*?(?:<\/explanation>|$)/gi, "")
                      .trim()
                      .split("\n").map((line, i, arr) => {
                      const parts = line.split(/(\*\*.*?\*\*)/g);
                      return (
                        <span key={i}>
                          {parts.map((part, j) => 
                            part.startsWith('**') && part.endsWith('**') 
                              ? <strong key={j}>{part.slice(2, -2)}</strong> 
                              : part
                          )}
                          {i < arr.length - 1 && <br />}
                        </span>
                      );
                    })}
                    {msg.isStreaming && (
                      <span className={styles.streamingCursor}>▋</span>
                    )}

                    {/* Render Interactive MCQ Buttons */}
                    {msg.mcqState && msg.mcqState.correct && (
                      <div className={styles.mcqOptions}>
                        {["A", "B", "C", "D"].map((letter) => {
                          const isAnswered = !!msg.mcqState?.answered;
                          const isCorrect = msg.mcqState?.correct === letter;
                          const isSelected = msg.mcqState?.answered === letter;
                          
                          let btnClass = styles.mcqBtn;
                          if (isAnswered) {
                            btnClass += ` ${styles.mcqBtnDisabled}`;
                            if (isCorrect) btnClass += ` ${styles.mcqBtnCorrect}`;
                            if (isSelected && !isCorrect) btnClass += ` ${styles.mcqBtnWrong}`;
                          }

                          return (
                            <button
                              key={letter}
                              className={btnClass}
                              disabled={isAnswered || isStreaming}
                              onClick={() => {
                                setMessages(prev => prev.map(m => 
                                  m.id === msg.id ? { ...m, mcqState: { ...m.mcqState!, answered: letter } } : m
                                ));
                                setScore(prev => ({
                                  ...prev,
                                  [isCorrect ? "correct" : "wrong"]: prev[isCorrect ? "correct" : "wrong"] + 1,
                                  total: prev.total + 1
                                }));
                              }}
                            >
                              <strong>{letter}</strong>
                            </button>
                          );
                        })}
                        {msg.mcqState.answered && msg.mcqState.explanation && (
                          <div className={styles.mcqExplanation}>
                            <strong>Explanation:</strong><br />
                            {msg.mcqState.explanation}
                            
                            {/* Next Question Button */}
                            <div style={{ marginTop: "16px", textAlign: "right" }}>
                              <button
                                className={styles.newSessionBtn}
                                style={{ display: "inline-flex", width: "auto", padding: "8px 16px" }}
                                onClick={() => sendMessage("Next question please.")}
                                disabled={isStreaming}
                              >
                                Next Question ➡️
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Score Badge */}
                  {msg.score && (
                    <span
                      className={`${styles.scoreBadge} ${
                        msg.score === "correct"
                          ? styles.scoreBadgeCorrect
                          : msg.score === "partial"
                          ? styles.scoreBadgePartial
                          : styles.scoreBadgeWrong
                      }`}
                    >
                      {msg.score === "correct"
                        ? "✓ Correct"
                        : msg.score === "partial"
                        ? "◑ Partial"
                        : "✗ Incorrect"}
                    </span>
                  )}

                  {/* TASK 2: Citation Cards */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className={styles.citations}>
                      {msg.citations.map((c, i) => (
                        <div key={i} className={styles.citation}>
                          <span className={styles.citationIcon}>📖</span>
                          <span>{c.citation}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    className={`${styles.messageMeta} ${
                      msg.role === "user" ? styles.messageMetaUser : ""
                    }`}
                  >
                    {msg.time}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Typing Indicator */}
          {isStreaming && messages[messages.length - 1]?.role !== "ai" && (
            <div className={styles.typing}>
              <div className={`${styles.avatar} ${styles.avatarAi}`}>🤖</div>
              <div className={styles.typingBubble}>
                <div className={styles.typingDot} />
                <div className={styles.typingDot} />
                <div className={styles.typingDot} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Area ────────────────────────────────────────────────── */}
        <div className={styles.inputArea}>
          {activeTopic && (
            <div className={styles.inputHints}>
              <span className={styles.inputHint}>💡 Answer in full sentences</span>
              <span className={styles.inputHint}>⏎ Send</span>
              <span className={styles.inputHint}>⇧⏎ New line</span>
              {mounted && isSpeechRecognitionSupported() && (
                <span className={styles.inputHint}>🎤 Click mic to speak</span>
              )}
            </div>
          )}
          <div className={styles.inputRow}>
            <div className={styles.inputWrapper}>
              <textarea
                ref={inputRef}
                id="viva-input"
                className={styles.input}
                placeholder={
                  !activeTopic
                    ? "Select a topic to begin your viva session..."
                    : isStreaming
                    ? "Examiner is responding..."
                    : "Type your answer here..."
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!activeTopic || isStreaming || (messages.length > 0 && messages[messages.length - 1]?.mcqState && !messages[messages.length - 1]?.mcqState?.answered)}
                rows={1}
              />
            </div>

            {/* BONUS: Microphone Button */}
            {mounted && isSpeechRecognitionSupported() && (
              <button
                id="mic-btn"
                className={`${styles.micBtn} ${isListening ? styles.micBtnActive : ""}`}
                onClick={toggleListening}
                disabled={!activeTopic || isStreaming || (messages.length > 0 && messages[messages.length - 1]?.mcqState && !messages[messages.length - 1]?.mcqState?.answered)}
                title={isListening ? "Stop listening" : "Speak your answer"}
                aria-label="Voice input"
              >
                {isListening ? "🔴" : "🎤"}
              </button>
            )}

            <button
              id="send-btn"
              className={styles.sendBtn}
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming || !activeTopic}
              aria-label="Send answer"
            >
              ↑
            </button>
          </div>
          <div className={styles.inputFooter}>
            {uploadJob?.status === "ready"
              ? `📚 Knowledge base active: ${uploadJob.filename} · Responses are grounded and cited`
              : "Upload a PDF to enable cited, grounded responses · Powered by Azure AI Foundry"}
          </div>
        </div>
      </main>

      {/* ── Right Panel: Stats ───────────────────────────────────────────── */}
      <aside className={styles.rightPanel}>
        <div className={styles.panelHeader}>📊 Session Stats</div>

        <div className={styles.scoreCard}>
          <div className={styles.scoreValue}>{accuracy}%</div>
          <div className={styles.scoreLabel}>Accuracy</div>
          <div className={styles.scoreBar}>
            <div
              className={styles.scoreBarFill}
              style={{ width: `${accuracy}%` }}
            />
          </div>
        </div>

        {/* ── Mastery Matrix ────────────────────────────────────────────── */}
        <div className={styles.masteryCard}>
          <div className={styles.masteryTitle}>Board Readiness Index</div>
          <div className={styles.masteryBarContainer}>
            <div
              className={isWarning ? styles.masteryBarFillWarning : styles.masteryBarFill}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className={styles.masterySubtext}>
            {readinessText}
          </div>
        </div>

        <div className={styles.statsList}>
          {[
            { label: "✅ Correct", value: score.correct, color: "var(--brand-success)" },
            { label: "🔶 Partial", value: score.partial, color: "var(--brand-warning)" },
            { label: "❌ Wrong", value: score.wrong, color: "var(--brand-danger)" },
            { label: "📝 Total Asked", value: score.total, color: "var(--text-primary)" },
          ].map((s) => (
            <div key={s.label} className={styles.statRow}>
              <span className={styles.statRowLabel}>{s.label}</span>
              <span className={styles.statRowValue} style={{ color: s.color }}>
                {s.value}
              </span>
            </div>
          ))}
          <div className={styles.statRow}>
            <span className={styles.statRowLabel}>📚 Topic</span>
            <span className={styles.statRowValue} style={{ fontSize: 12 }}>
              {activeTopic || "—"}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statRowLabel}>🔊 Voice Mode</span>
            <span className={styles.statRowValue} style={{ fontSize: 12, color: voiceMode ? "var(--brand-success)" : "var(--text-muted)" }}>
              {voiceMode ? "On" : "Off"}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statRowLabel}>📄 Knowledge Base</span>
            <span
              className={styles.statRowValue}
              style={{
                fontSize: 12,
                color:
                  uploadJob?.status === "ready"
                    ? "var(--brand-success)"
                    : uploadJob?.status === "processing"
                    ? "var(--brand-warning)"
                    : "var(--text-muted)",
              }}
            >
              {uploadJob?.status === "ready"
                ? "Active"
                : uploadJob?.status === "processing"
                ? `${uploadJob.progress}%`
                : "No docs"}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
