// @ts-nocheck
"use client";
import { useState, useEffect } from "react";

const REPO = "enparticle/taskflow";

// 커밋 메시지를 카테고리로 분류
function categorize(message: string) {
  const m = message.toLowerCase();
  if (m.includes("fix") || m.includes("버그") || m.includes("수정") || m.includes("오류")) return { label: "버그 수정", color: "#DC2626", bg: "#FEF2F2", icon: "🐛" };
  if (m.includes("feat") || m.includes("add") || m.includes("추가") || m.includes("신규") || m.includes("기능")) return { label: "새 기능", color: "#16A34A", bg: "#F0FDF4", icon: "✨" };
  if (m.includes("ui") || m.includes("light") || m.includes("theme") || m.includes("스타일") || m.includes("디자인") || m.includes("레이아웃")) return { label: "UI 개선", color: "#2563EB", bg: "#EEF3FF", icon: "🎨" };
  if (m.includes("perf") || m.includes("성능") || m.includes("속도")) return { label: "성능", color: "#D97706", bg: "#FFFBEB", icon: "⚡" };
  if (m.includes("refactor") || m.includes("리팩") || m.includes("정리")) return { label: "리팩토링", color: "#7C3AED", bg: "#F5F3FF", icon: "🔧" };
  return { label: "업데이트", color: "#6B7280", bg: "#F9FAFB", icon: "📦" };
}

// 커밋 메시지를 한글로 요약
function summarize(message: string): string {
  const map: Record<string, string> = {
    "v2 light theme": "라이트 테마 적용",
    "bottom nav": "하단 네비게이션",
    "light theme": "라이트 테마",
    "fix briefing": "AI 브리핑 수정",
    "auto-trigger": "AI 브리핑 자동 실행",
    "meeting note": "회의 기록",
    "recording": "녹음 기능",
    "file upload": "파일 업로드",
    "transcribe": "음성 변환",
    "analyze-meeting": "회의록 분석",
    "priority": "우선순위",
    "focus card": "집중 업무 카드",
    "unassigned": "미배정 업무 필터",
    "recurring": "반복 업무",
    "ai feedback": "AI 피드백",
    "history": "이전 기록",
    "viewer": "전체 현황 뷰어",
    "project assistant": "프로젝트 어시스턴트",
    "context": "프로젝트 컨텍스트",
    "change detection": "방향 변경 감지",
    "encoding": "한글 인코딩",
    "dashboard": "홈 화면",
    "tasks page": "업무 페이지",
    "projects page": "프로젝트 페이지",
    "calendar": "캘린더",
    "team": "팀 현황",
    "reports": "리포트",
    "settings": "설정",
    "guide": "사용 가이드",
    "taskdetail": "업무 상세",
    "syntax error": "코드 오류 수정",
    "onChange": "파일 입력 수정",
    "max_tokens": "분석 토큰 증가",
    "Korean": "한글 처리",
  };

  let result = message;
  for (const [key, val] of Object.entries(map)) {
    if (result.toLowerCase().includes(key.toLowerCase())) {
      return val;
    }
  }
  return result.replace(/^(fix|feat|refactor|update|add|improve|v\d+\.?\d*)\s+/i, "").slice(0, 60);
}

function getChangedPages(files: string[]): string[] {
  const pageMap: Record<string, string> = {
    "dashboard": "홈",
    "tasks": "업무",
    "projects": "프로젝트",
    "calendar": "캘린더",
    "meeting-note": "회의 기록",
    "team": "팀 현황",
    "reports": "리포트",
    "settings": "설정",
    "guide": "사용 가이드",
    "admin": "팀원 관리",
    "recurring": "반복 업무",
    "ai": "AI",
    "viewer": "뷰어",
    "project-assistant": "프로젝트 어시스턴트",
    "changelog": "변경 이력",
    "layout": "레이아웃",
    "globals": "전체 스타일",
    "TaskDetail": "업무 상세",
    "PlanningFeedback": "AI 피드백",
    "briefing": "AI 브리핑",
    "analyze-meeting": "회의록 분석",
    "transcribe": "음성 변환",
    "analyze-change": "변경 분석",
  };
  const pages: string[] = [];
  for (const file of files) {
    for (const [key, label] of Object.entries(pageMap)) {
      if (file.includes(key) && !pages.includes(label)) {
        pages.push(label);
      }
    }
  }
  return pages;
}

export default function ChangelogPage() {
  const [commits, setCommits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState("all");

  async function loadCommits(p = 1) {
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/commits?per_page=30&page=${p}`,
        { headers: { Accept: "application/vnd.github.v3+json" } }
      );
      if (!res.ok) throw new Error("GitHub API 오류");
      const data = await res.json();

      // 각 커밋의 변경 파일 가져오기 (최근 10개만)
      const withFiles = await Promise.all(
        data.slice(0, 10).map(async (c: any) => {
          try {
            const detail = await fetch(`https://api.github.com/repos/${REPO}/commits/${c.sha}`,
              { headers: { Accept: "application/vnd.github.v3+json" } }
            );
            const d = await detail.json();
            return { ...c, files: (d.files ?? []).map((f: any) => f.filename) };
          } catch { return { ...c, files: [] }; }
        })
      );
      const rest = data.slice(10).map((c: any) => ({ ...c, files: [] }));

      if (p === 1) setCommits([...withFiles, ...rest]);
      else setCommits(prev => [...prev, ...withFiles, ...rest]);

      setHasMore(data.length === 30);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  useEffect(() => { loadCommits(1); }, []);

  const categories = ["all", "새 기능", "버그 수정", "UI 개선", "업데이트"];

  const filtered = commits.filter(c => {
    if (filter === "all") return true;
    return categorize(c.commit.message).label === filter;
  });

  // 날짜별 그룹핑
  const grouped: Record<string, any[]> = {};
  filtered.forEach(c => {
    const date = new Date(c.commit.author.date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(c);
  });

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 18, background: "var(--cyan)", borderRadius: 2 }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>변경 이력</h1>
          <a href={`https://github.com/${REPO}/commits/main`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: "var(--text-3)", textDecoration: "none" }}>
            GitHub ↗
          </a>
        </div>
        <button onClick={() => loadCommits(1)}
          style={{ fontSize: 12, padding: "5px 12px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-2)", cursor: "pointer" }}>
          🔄 새로고침
        </button>
      </div>

      {/* 카테고리 필터 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            style={{
              padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
              background: filter === cat ? "var(--cyan)" : "var(--bg-2)",
              color: filter === cat ? "#fff" : "var(--text-3)",
              border: `1px solid ${filter === cat ? "var(--cyan)" : "var(--border)"}`,
            }}>
            {cat === "all" ? "전체" : cat}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px" }}>
          <p style={{ fontSize: 12, color: "#DC2626", margin: 0 }}>GitHub API 오류: {error}</p>
        </div>
      )}

      {/* 날짜별 그룹 */}
      {Object.entries(grouped).map(([date, dayCommits]) => (
        <div key={date}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", marginBottom: 8, paddingLeft: 2 }}>{date}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {dayCommits.map((c: any) => {
              const cat = categorize(c.commit.message);
              const summary = summarize(c.commit.message);
              const pages = getChangedPages(c.files ?? []);
              const time = new Date(c.commit.author.date).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
              return (
                <div key={c.sha} style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  {/* 카테고리 아이콘 */}
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                    {cat.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, fontWeight: 600, background: cat.bg, color: cat.color, border: `1px solid ${cat.color}30` }}>
                        {cat.label}
                      </span>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)", margin: 0 }}>{summary}</p>
                    </div>
                    {pages.length > 0 && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 4 }}>
                        {pages.map(p => (
                          <span key={p} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--bg-3)", color: "var(--text-3)", border: "1px solid var(--border)" }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>{time}</span>
                      <a href={`https://github.com/${REPO}/commit/${c.sha}`} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "monospace", textDecoration: "none" }}>
                        {c.sha.slice(0, 7)}
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {loading && (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ width: 24, height: 24, border: "3px solid var(--cyan)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 8px" }} />
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>불러오는 중…</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {!loading && hasMore && (
        <button onClick={() => { setPage(p => p + 1); loadCommits(page + 1); }}
          style={{ padding: "10px 0", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-2)", cursor: "pointer" }}>
          더 보기
        </button>
      )}
    </div>
  );
}
