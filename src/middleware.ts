// @ts-nocheck
import { NextResponse, type NextRequest } from "next/server";

// 미들웨어 비활성화 - 클라이언트에서 직접 처리
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
