// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";

export default function MorePage() {
  const router = useRouter();
  const [role, setRole] = useState("");

  useEffect(() => {
    getAuthUser().then(u => { if (u) setRole(u.role); });
  }, []);

  const isLeader = role === "admin" || role === "leader";
  const isAdmin = role === "admin";

  const items = [
    { href: "/meeting-note", icon: "📝", label: "회의 기록", desc: "회의 내용을 기록하고 업무를 추출합니다" },
    ...(isLeader ? [
      { href: "/team",    icon: "◈", label: "팀 현황",    desc: "팀원별 업무량과 현황을 확인합니다" },
      { href: "/reports", icon: "📊", label: "리포트",     desc: "프로젝트 분석 리포트를 확인합니다" },
      { href: "/tree",    icon: "🌳", label: "업무 트리",  desc: "업무 의존성 구조를 시각화합니다" },
    ] : []),
    ...(isAdmin ? [
      { href: "/admin",         icon: "🧠", label: "팀원 프로필 관리", desc: "팀원 정보와 성향을 관리합니다" },
      { href: "/report-export", icon: "📋", label: "외부용 보고서",    desc: "외부 공유용 보고서를 생성합니다" },
    ] : []),
    { href: "/guide",    icon: "📖", label: "사용 가이드", desc: "역할별 TaskFlow 사용법을 안내합니다" },
    { href: "/settings", icon: "⚙",  label: "설정",        desc: "계정 및 알림 설정을 변경합니다" },
    { href: "/viewer", icon: "📺", label: "전체 현황 뷰어", desc: "TV 대시보드를 새 탭에서 엽니다", external: true },
  ];

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full" style={{ background: "var(--cyan)" }} />
        <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>더보기</h1>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <a key={item.href} href={item.href} target={item.external ? "_blank" : undefined}
            rel={item.external ? "noopener noreferrer" : undefined}
            className="flex items-center gap-4 rounded-xl px-5 py-4 transition-all"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border)", textDecoration: "none", display: "flex" }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border-2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; }}>
            <span style={{ fontSize: 22 }}>{item.icon}</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{item.label}</p>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>{item.desc}</p>
            </div>
            <span style={{ marginLeft: "auto", fontSize: 14, color: "var(--text-3)" }}>→</span>
          </a>
        ))}
      </div>
    </div>
  );
}
