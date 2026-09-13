"use client";

import Link from "next/link";
import { useLanguage } from "./_components/LanguageContext";
import LanguageSwitcher from "./_components/LanguageSwitcher";
import CreateWorkspace from "./_components/create-workspace";
import ClearDbButton from "./_components/clear-db";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Network, Terminal, Cpu, Zap, ChevronRight } from "lucide-react";

type Workspace = {
  id: string;
  name: string;
  createdAt: string;
};

function seededParticleValue(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

// Typing effect hook
function useTypingEffect(text: string, speed: number = 80, delay: number = 0) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const interval = setInterval(() => {
      if (i <= text.length) {
        setDisplayed(text.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [started, text, speed]);

  return displayed;
}

// Animated background particles
function ParticleBackground() {
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      pointerEvents: "none",
    }}>
      {Array.from({ length: 30 }).map((_, i) => {
        const width = seededParticleValue(i, 1) * 3 + 1;
        const height = seededParticleValue(i, 2) * 3 + 1;
        const left = seededParticleValue(i, 3) * 100;
        const top = seededParticleValue(i, 4) * 100;
        const duration = seededParticleValue(i, 5) * 4 + 3;
        const delay = seededParticleValue(i, 6) * 3;

        return (
          <motion.div
            key={i}
            style={{
              position: "absolute",
              width: `${width.toFixed(5)}px`,
              height: `${height.toFixed(5)}px`,
              borderRadius: "50%",
              backgroundColor: "var(--landing-particle)",
              left: `${left.toFixed(4)}%`,
              top: `${top.toFixed(4)}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration,
              repeat: Infinity,
              delay,
              ease: "easeInOut",
            }}
          />
        );
      })}
      {/* Grid lines */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.06 }}>
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" style={{ stroke: "var(--landing-grid)" }} strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}

// Feature card component
function FeatureCard({
  href,
  icon: Icon,
  title,
  description,
  color,
  delay,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  delay: number;
}) {
  const { theme } = useLanguage();
  const isDark = theme === "dark";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.4, 0, 0.2, 1] }}
    >
      <Link href={href} style={{ textDecoration: "none" }}>
        <motion.div
          style={{
            background: "var(--landing-glass-strong)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid var(--landing-surface-border)",
            borderRadius: 20,
            padding: 32,
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
          }}
          whileHover={{
            y: -4,
            boxShadow: isDark
              ? `0 20px 40px var(--landing-shadow-hover), 0 0 30px color-mix(in srgb, ${color} 12.55%, transparent)`
              : `0 20px 40px var(--landing-shadow-hover), 0 0 30px color-mix(in srgb, ${color} 20%, transparent)`,
          }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.3 }}
        >
          {/* Glow effect on hover */}
          <div style={{
            position: "absolute",
            top: -50,
            right: -50,
            width: 150,
            height: 150,
            borderRadius: "50%",
            background: color,
            opacity: 0.08,
            filter: "blur(40px)",
          }} />
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: `color-mix(in srgb, ${color} 8.24%, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
            border: `1px solid color-mix(in srgb, ${color} 12.55%, transparent)`,
          }}>
            <Icon size={24} color={color} />
          </div>
          <div style={{
            fontSize: 18,
            fontWeight: 600,
            color: "var(--landing-text)",
            marginBottom: 8,
            letterSpacing: "-0.01em",
          }}>
            {title}
          </div>
          <div style={{
            fontSize: 14,
            color: "var(--landing-text-secondary)",
            lineHeight: 1.5,
            marginBottom: 16,
          }}>
            {description}
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 13,
            fontWeight: 500,
            color,
          }}>
            进入
            <ChevronRight size={14} />
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

export default function HomePage() {
  const { t, theme } = useLanguage();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const typedTitle = useTypingEffect("Swarm IDE", 120, 500);
  const typedSubtitle = useTypingEffect("Multi-Agent Orchestration Interface", 40, 1200);

  useEffect(() => {
    async function fetchWorkspaces() {
      try {
        const res = await fetch("/api/workspaces");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setWorkspaces(data.workspaces || []);
      } catch (e) {
        setDbError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    void fetchWorkspaces();
  }, []);

  const isDark = theme === "dark";
  const bgColor = "var(--landing-bg)";
  const textPrimary = "var(--landing-text)";
  const textSecondary = "var(--landing-text-secondary)";
  const textMuted = "var(--landing-text-muted)";
  const borderColor = "var(--landing-border)";
  const accentColor = "var(--landing-accent)";

  return (
    <div style={{
      minHeight: "100vh",
      background: bgColor,
      color: textPrimary,
      colorScheme: isDark ? "dark" : "light",
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Hero Section */}
      <div style={{
        position: "relative",
        padding: "80px 24px 60px",
        textAlign: "center",
        overflow: "hidden",
        background: "linear-gradient(180deg, var(--landing-hero-from) 0%, var(--landing-hero-mid) 40%, var(--landing-hero-to) 100%)",
      }}>
        <ParticleBackground />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto" }}>
          {/* Terminal badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 100,
              background: "var(--landing-accent-tint)",
              border: "1px solid var(--landing-accent-border)",
              marginBottom: 32,
              fontSize: 13,
              color: accentColor,
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            <Terminal size={14} />
            <span>v2.0.0 — Ready for orchestration</span>
          </motion.div>

          {/* Main Title with typing effect */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            style={{
              margin: 0,
              fontSize: "clamp(40px, 8vw, 72px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              marginBottom: 16,
              fontFamily: '"SF Pro Display", -apple-system, sans-serif',
            }}
          >
            {typedTitle}
            <span className="terminal-cursor" style={{ background: accentColor }} />
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            style={{
              margin: 0,
              fontSize: "clamp(16px, 3vw, 20px)",
              color: textSecondary,
              fontWeight: 400,
              lineHeight: 1.5,
              marginBottom: 8,
              fontFamily: '"JetBrains Mono", monospace',
              minHeight: 30,
            }}
          >
            {typedSubtitle}
            {typedSubtitle.length < "Multi-Agent Orchestration Interface".length && (
              <span className="terminal-cursor" style={{ background: accentColor }} />
            )}
          </motion.p>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.8 }}
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 32,
              marginTop: 40,
              flexWrap: "wrap",
            }}
          >
            {[
              { icon: Cpu, label: "智能体", value: "∞" },
              { icon: Zap, label: "并发", value: "16x" },
              { icon: MessageSquare, label: "消息", value: "实时" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 20px",
                borderRadius: 12,
                background: "var(--landing-chip-bg)",
                border: "1px solid var(--landing-chip-border)",
              }}>
                <Icon size={16} color={accentColor} />
                <span style={{ fontSize: 13, color: textMuted }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: textPrimary, fontFamily: '"JetBrains Mono", monospace' }}>
                  {value}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "40px 24px 60px",
      }}>
        {/* Language Switcher */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 32,
          }}
        >
          <LanguageSwitcher />
        </motion.div>

        {/* Quick Actions */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20,
          marginBottom: 40,
        }}>
          <FeatureCard
            href="/im"
            icon={MessageSquare}
            title={t.openIM || "智能对话"}
            description="与多个 AI 智能体实时协作，支持流式输出与工具调用"
            color="var(--landing-accent)"
            delay={2.2}
          />
          <FeatureCard
            href="/graph"
            icon={Network}
            title={t.openGraph || "关系图谱"}
            description="可视化智能体之间的协作关系与消息流向"
            color="var(--landing-accent-green)"
            delay={2.4}
          />
        </div>

        {/* Create Workspace */}
        {dbError ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.6 }}
            style={{
              background: "var(--landing-error-bg)",
              border: "1px solid var(--landing-error-border)",
              padding: 24,
              marginBottom: 32,
              borderRadius: 16,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--landing-error)", fontSize: 14 }}>
              {t.databaseNotReady}
            </div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "var(--landing-error)", fontFamily: '"JetBrains Mono", monospace' }}>
              {dbError}
            </div>
          </motion.div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.6 }}
          style={{
            background: "var(--landing-glass-strong)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: `1px solid ${borderColor}`,
            borderRadius: 20,
            padding: 28,
            marginBottom: 32,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 20, color: textPrimary }}>
            {t.createWorkspace}
          </div>
          <CreateWorkspace />
        </motion.div>

        {/* Workspaces List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.8 }}
        >
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8, color: textPrimary }}>
            {t.workspaces}
          </div>
          <p style={{ marginTop: 0, marginBottom: 20, fontSize: 13, color: textSecondary }}>
            {t.workspacesTip}
          </p>

          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{ color: textMuted, fontSize: 14 }}
              >
                {t.loading}
              </motion.div>
            </div>
          ) : workspaces.length === 0 ? (
            <div style={{
              background: "var(--landing-glass-subtle)",
              border: `1px solid ${borderColor}`,
              borderRadius: 16,
              padding: 48,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📁</div>
              <div style={{ color: textSecondary, fontSize: 14 }}>{t.noWorkspaces}</div>
              <div style={{ color: textMuted, fontSize: 12, marginTop: 4 }}>{t.noWorkspacesTip}</div>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 12,
            }}>
              {workspaces.map((w, i) => (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 3 + i * 0.1 }}
                >
                  <Link href={`/im?workspaceId=${encodeURIComponent(w.id)}`} style={{ textDecoration: "none" }}>
                    <motion.div
                      style={{
                        background: "var(--landing-glass)",
                        border: `1px solid ${borderColor}`,
                        borderRadius: 14,
                        padding: 18,
                        cursor: "pointer",
                      }}
                      whileHover={{
                        background: "var(--landing-glass-hover)",
                        borderColor: "var(--landing-accent-border-strong)",
                        y: -2,
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 8,
                      }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: "var(--landing-accent-tint)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid var(--landing-accent-border-soft)",
                        }}>
                          <MessageSquare size={16} color={accentColor} />
                        </div>
                        <div style={{
                          fontWeight: 600,
                          color: textPrimary,
                          fontSize: 15,
                          flex: 1,
                        }}>
                          {w.name}
                        </div>
                        <ChevronRight size={16} color={textMuted} />
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: textMuted,
                        fontFamily: '"JetBrains Mono", monospace',
                        marginLeft: 48,
                      }}>
                        {new Date(w.createdAt).toLocaleString()}
                      </div>
                    </motion.div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Admin Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 3.2 }}
          style={{
            background: "var(--landing-glass-subtle)",
            border: `1px solid ${borderColor}`,
            borderRadius: 20,
            padding: 24,
            marginTop: 40,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: textSecondary }}>
            {t.admin}
          </div>
          <ClearDbButton />
        </motion.div>
      </div>
    </div>
  );
}
