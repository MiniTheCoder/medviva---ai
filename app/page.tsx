import Link from "next/link";
import styles from "./page.module.css";

const features = [
  {
    icon: "🧠",
    iconBg: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))",
    title: "RAG-Powered Knowledge Base",
    desc: "Upload your medical textbooks and study notes. Our AI reads and indexes every page, pulling exact citations during your viva session.",
  },
  {
    icon: "⚡",
    iconBg: "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(99,102,241,0.1))",
    title: "Adaptive Difficulty",
    desc: "The AI tracks your weak areas in real-time and automatically pushes harder questions on topics where you need the most improvement.",
  },
  {
    icon: "🎯",
    iconBg: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.1))",
    title: "Cited Feedback",
    desc: "Every correction comes with a page reference from your own uploaded material — just like a real examiner reviewing your textbook.",
  },
  {
    icon: "🔥",
    iconBg: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(245,158,11,0.1))",
    title: "Ruthless Examiner Mode",
    desc: "Don't know the answer? The AI won't let you off easy. It probes deeper, cross-questions, and challenges you until you truly understand.",
  },
  {
    icon: "📊",
    iconBg: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.1))",
    title: "Performance Analytics",
    desc: "Track your accuracy across topics, see your improvement over time, and identify the exact chapters you need to revise before your exam.",
  },
  {
    icon: "🏆",
    iconBg: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.1))",
    title: "Exam-Ready Simulation",
    desc: "Practice realistic NEET-PG, USMLE, and clinical viva scenarios. The AI mimics real examiner styles so you are never caught off-guard.",
  },
];

const steps = [
  {
    num: "1",
    title: "Upload Your Notes",
    desc: "Drag and drop your medical textbooks, lecture notes, or study material. Our Azure AI indexes every page in seconds.",
  },
  {
    num: "2",
    title: "Choose Your Topic",
    desc: "Select a subject — Anatomy, Pharmacology, Medicine, Surgery — and the AI will craft a realistic viva session tailored to that topic.",
  },
  {
    num: "3",
    title: "Face the Examiner",
    desc: "The AI fires real-world viva questions at you. Answer in plain text, just like a real verbal exam. No multiple choice. No shortcuts.",
  },
  {
    num: "4",
    title: "Get Cited Feedback",
    desc: "After each answer, the AI grades you and pulls the exact reference from your own notes to show you what you missed and why.",
  },
];

export default function Home() {
  return (
    <div className={styles.page}>
      {/* Background Effects */}
      <div className={styles.bgGlow} />
      <div className={styles.bgGrid} />

      {/* Navigation */}
      <nav className={styles.nav}>
        <Link href="/" className={styles.navLogo}>
          <div className={styles.navLogoIcon}>🧬</div>
          <span className={styles.navLogoText}>MedViva AI</span>
        </Link>
        <span className={styles.navBadge}>🏆 Microsoft Hackathon 2026</span>
        <div className={styles.navActions}>
          <Link href="/viva" className="btn-secondary">
            Try Demo
          </Link>
          <Link href="/viva" className="btn-primary">
            Start Preparation →
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={`${styles.heroBadge} animate-fade-up`}>
          <span className={styles.heroBadgeDot} />
          Powered by Azure AI + RAG Technology
        </div>

        <h1 className={`${styles.heroTitle} animate-fade-up animate-fade-up-delay-1`}>
          Your Ruthless
          <span className={styles.heroTitleLine2}>AI Medical Examiner</span>
        </h1>

        <p className={`${styles.heroSubtitle} animate-fade-up animate-fade-up-delay-2`}>
          Stop reading. Start answering. Our AI simulates a real viva examiner — probing, cross-questioning, and citing your own notes when you are wrong.
        </p>

        {/* Chat Preview */}
        <div className={`${styles.chatPreview} animate-fade-up animate-fade-up-delay-2`}>
          <div className={styles.chatPreviewHeader}>
            <div className={styles.chatPreviewDots}>
              <div className={styles.chatPreviewDot} style={{ background: "#ef4444" }} />
              <div className={styles.chatPreviewDot} style={{ background: "#f59e0b" }} />
              <div className={styles.chatPreviewDot} style={{ background: "#10b981" }} />
            </div>
            <span className={styles.chatPreviewTitle}>MedViva Examiner — Pharmacology Session</span>
            <span className={styles.chatPreviewStatus}>
              <span style={{ width: 6, height: 6, background: "#10b981", borderRadius: "50%", display: "inline-block" }} />
              Live
            </span>
          </div>
          <div className={styles.chatPreviewBody}>
            <div className={`${styles.chatMsg} ${styles.chatMsgAi}`}>
              <div className={`${styles.chatMsgAvatar} ${styles.chatMsgAvatarAi}`}>AI</div>
              <div className={`${styles.chatMsgBubble} ${styles.chatMsgBubbleAi}`}>
                A patient presents with bradycardia, hypotension, and cold extremities after an overdose. Which drug class is most likely responsible, and what is the antidote of choice?
              </div>
            </div>
            <div className={`${styles.chatMsg} ${styles.chatMsgUser}`}>
              <div className={`${styles.chatMsgAvatar} ${styles.chatMsgAvatarUser}`}>You</div>
              <div className={`${styles.chatMsgBubble} ${styles.chatMsgBubbleUser}`}>
                Beta-blockers. The antidote is glucagon, which bypasses the blocked receptors.
              </div>
            </div>
            <div className={`${styles.chatMsg} ${styles.chatMsgAi}`}>
              <div className={`${styles.chatMsgAvatar} ${styles.chatMsgAvatarAi}`}>AI</div>
              <div className={`${styles.chatMsgBubble} ${styles.chatMsgBubbleAi}`}>
                Correct. Now, what is the mechanism by which glucagon reverses beta-blocker toxicity? Be specific about the signaling pathway<span className={styles.chatPreviewCursor} />
              </div>
            </div>
          </div>
        </div>

        <div className={`${styles.heroActions} animate-fade-up animate-fade-up-delay-3`}>
          <Link href="/viva" id="start-viva-btn" className="btn-primary">
            🚀 Start Your Session
          </Link>
          <Link href="#features" id="learn-more-btn" className="btn-secondary">
            See How It Works
          </Link>
        </div>

        <div className={`${styles.heroStats} glass animate-fade-up animate-fade-up-delay-4`}>
          <div className={styles.heroStat}>
            <div className={styles.heroStatValue}>10K+</div>
            <div className={styles.heroStatLabel}>Questions Generated</div>
          </div>
          <div className={styles.heroStatDivider} />
          <div className={styles.heroStat}>
            <div className={styles.heroStatValue}>95%</div>
            <div className={styles.heroStatLabel}>Accuracy Rate</div>
          </div>
          <div className={styles.heroStatDivider} />
          <div className={styles.heroStat}>
            <div className={styles.heroStatValue}>0ms</div>
            <div className={styles.heroStatLabel}>Response Delay</div>
          </div>
          <div className={styles.heroStatDivider} />
          <div className={styles.heroStat}>
            <div className={styles.heroStatValue}>Azure</div>
            <div className={styles.heroStatLabel}>AI Powered</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={styles.features}>
        <div>
          <span className={styles.sectionLabel}>✦ Features</span>
          <h2 className={styles.sectionTitle}>
            Everything you need to{" "}
            <span className="gradient-text">ace your exams</span>
          </h2>
          <p className={styles.sectionSubtitle}>
            Built for medical students who want to practice smarter, not harder. Every feature is designed to simulate real exam pressure.
          </p>
        </div>
        <div className={styles.featuresGrid}>
          {features.map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <div className={styles.featureIcon} style={{ background: f.iconBg }}>
                {f.icon}
              </div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className={styles.howItWorks}>
        <div className={styles.howItWorksInner}>
          <span className={styles.sectionLabel}>✦ How It Works</span>
          <h2 className={styles.sectionTitle}>
            From zero to exam-ready{" "}
            <span className="gradient-text">in minutes</span>
          </h2>
          <p className={styles.sectionSubtitle}>
            No complex setup. No lengthy onboarding. Just upload, select, and start answering.
          </p>
          <div className={styles.steps}>
            {steps.map((step) => (
              <div key={step.num} className={styles.step}>
                <div className={styles.stepNumber}>{step.num}</div>
                <div className={styles.stepContent}>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepDesc}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <div className={styles.ctaCard}>
          <h2 className={styles.ctaTitle}>
            Ready to face your{" "}
            <span className="gradient-text">AI Examiner?</span>
          </h2>
          <p className={styles.ctaSubtitle}>
            Upload your notes and start your first viva session in under 60 seconds. No sign-up required.
          </p>
          <div className={styles.ctaActions}>
            <Link href="/viva" id="cta-start-btn" className="btn-primary">
              🚀 Start Free Session
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <span className={styles.footerText}>© 2026 MedViva AI. Built for Microsoft Agents League Hackathon.</span>
        <span className={styles.footerBadge}>
          <span>⚡</span> Powered by Azure AI Foundry + Azure AI Search
        </span>
      </footer>
    </div>
  );
}
