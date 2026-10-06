# TaskFlow 회의 녹음 보관 기능 — 적용 안내

작성: 2026-10-06. 기준: GitHub enparticle/taskflow HEAD 256d0ad00dda6c927b046d4e0e2138c7d1ffe246.

## 현재 상태

로컬 구현 및 검증 완료. 운영 Supabase에 SQL을 실행하지 않았으며 GitHub에 커밋하거나 Vercel에 배포하지 않았다. 기존 운영 서비스는 아직 브라우저 임시 녹음 방식이다.

## 동작

- 내장 녹음을 시작하기 전에 meeting_drafts에 회의록을 저장해 영구 ID를 확보한다. 녹음파일은 `meeting-audio/<meeting_drafts.id>/<UTC시각_UUID>.webm` 또는 `.m4a`로 저장한다.
- 매 10분 및 중지 시 녹음을 Supabase Storage로 직접 업로드한다. 서비스 비밀키를 브라우저에 넣지 않고 로그인 세션과 Storage RLS를 사용한다. Vercel 파일 업로드 본문을 거치지 않는다.
- 업로드 실패 표시, 동일 경로 재시도, PC에 원본 저장을 제공한다. 이미 성공한 업로드의 응답만 유실된 경우 같은 파일 경로·크기를 확인한다. `upsert:false`로 원본을 덮어쓰지 않는다.
- 회의록 작성/검토/완료 화면의 보관함에서 목록, 재생, 다운로드를 제공한다. 이력에서 회의록을 열어도 같은 ID의 녹음이 조회된다.
- 녹음 중지 시 마이크 트랙 및 분할 타이머를 해제한다. 분석, 새 회의록 시작, 이력 이동은 미완료 녹음이 있을 때 막는다.
- 기존 음성파일 업로드 탭에서 사용자가 선택한 외부 파일은 이번 자동 보관 대상에 포함하지 않았다. 이번 기능의 대상은 앱 내장 녹음이다.

## 접근 권한과 보관

- bucket: `meeting-audio`, private, 파일당 최대 50 MiB, MIME `audio/webm`, `audio/mp4`.
- 열람: 활성 계정 중 회의록 작성자 또는 전역 admin/leader. 비로그인·다른 일반 팀원·비활성 계정 차단. 일반 viewer는 다른 사람의 녹음에 접근 불가. 작성자가 viewer로 변경된 경우 자신의 기존 녹음은 읽을 수 있지만 업로드는 불가.
- 업로드: 위 범위에서 viewer 제외. meeting_drafts가 실제로 존재해야 한다.
- 다운로드/재생은 1시간 유효한 서명 URL을 사용한다. 발급된 링크는 만료 전까지 링크를 가진 사람이 이용할 수 있으므로 권한 회수 시 즉시 무효화된다고 안내하면 안 된다.
- 앱에서 원본 수정/삭제는 허용하지 않는다. Storage의 기존 광범위 허용 정책이 이 제한을 우회하지 못하도록 restrictive guard도 추가한다. 다른 버킷에는 추가 제한을 적용하지 않는다.
- 원본이 있는 회의록은 삭제를 차단한다. 명시적인 폐기 요청이 있을 때 관리자가 Storage API/대시보드로 먼저 원본을 삭제한 뒤 회의록을 삭제한다. storage.objects를 SQL DELETE해서 파일을 삭제하면 안 된다.
- 녹음 삭제·보관 기간 자동화는 포함하지 않았다. 사용량은 Supabase 대시보드에서 점검한다.

## 주의할 실제 한계

- 아직 분할되지 않은 최대 10분 분량은 메모리에 있다. 탭 강제종료·브라우저 종료·전원 중단 시 이 부분은 유실될 수 있다. 녹음 중지 후 보관함에서 저장 완료를 확인한다.
- 실패분은 그 화면의 메모리에 남는다. 재시도 또는 PC 원본 저장 없이 페이지를 떠나면 복구할 수 없다. beforeunload 경고는 브라우저 정책과 모바일 환경에 따라 표시가 제한될 수 있다.
- 내부 라우트 이동으로 컴포넌트가 해제될 때 중지·업로드를 시도하지만 강제종료 내구성을 보장하지 않는다. IndexedDB 오프라인 복구나 초 단위 업로드는 별도 기능이다.
- 원본 보관과 AI 음성 변환은 별개다. 이번 변경은 전사 API의 기존 크기 제한이나 Whisper 동작을 변경하지 않는다.
- DB 삭제 방지 트리거는 녹음 업로드와 회의록 삭제가 동시에 진행되는 모든 경합까지 직렬화하지 않는다. 녹음 중인 회의록을 다른 화면에서 삭제하는 운영은 피한다. 업로드 성공 직후 연결 검증은 클라이언트에서 추가로 수행한다.

## 검증 결과

- `npm ci --ignore-scripts` 후 `npm run build`: Next.js 프로덕션 빌드 성공, 43개 정적 페이지 생성.
- `node --test tests/meeting-audio.test.cjs`: 업로드·용량·네트워크 오류·중복 재시도 등 8개 통과.
- 별도 `audio-verification/verify.mjs`: PGlite 격리 PostgreSQL에서 private bucket, 작성자/관리자/리더, 비로그인/다른 팀원/비활성 계정, 기존 광범위 정책과의 결합, 다른 버킷 비간섭, 회의록 삭제 방지 21개 확인 통과. Supabase 전체 스키마/Storage API를 복제한 테스트는 아니다.
- `audio-verification/recorder.cjs`: 실제 회의록 React 컴포넌트를 JSDOM으로 실행하고 마이크와 Supabase를 대체한 통합 테스트 통과. 10분 분할, 실패 재시도 동일 경로, 마지막 조각 저장, 마이크 해제, 중지 후 재시작, 같은 회의 연결을 검증했다.
- 실제 브라우저 마이크 + 실제 Supabase Storage 업로드/재생의 종단 간 테스트는 아직 수행하지 않았다.

## 배포 순서

1. 배포 시 GitHub HEAD가 기준 커밋과 같은지 확인한다. 다르면 이 패치를 최신 소스에 병합해 다시 검증한다.
2. Supabase 테스트 프로젝트에서 기존 users/meeting_drafts 권한을 포함한 실제 스키마를 복제하고 `supabase/migrations/202610060001_meeting_audio.sql`을 실행한다. 마이그레이션은 1회 적용용이다. 이미 존재하는 호환되지 않는 버킷은 오류로 중단한다.
3. 마이그레이션 전후 storage.objects 정책, bucket 공개 여부, users/meeting_drafts SELECT 권한을 점검한다. 기존 RLS 때문에 조회 불가한 경우 정책을 넓히지 말고 권한 원인을 확인한다.
4. 소스 변경을 별도 브랜치에 올리고 Vercel Preview를 테스트 프로젝트로 연결한다. 로그인 후 짧은 실제 녹음, 중지, 새로고침, 이력 재생/다운로드, 네트워크 실패·재시도, 10분 경계·재시작, 비인가 계정 차단을 확인한다. 음성 권한 거부도 확인한다.
5. 운영 적용 승인 후 SQL을 운영 DB에 먼저 적용한다. 이어 소스를 병합·배포한다. 로그인된 실제 계정으로 스모크 테스트한다.
6. 문제가 있으면 앱 배포를 이전 버전으로 돌린다. 이미 저장된 원본을 보존하기 위해 bucket이나 objects를 삭제하지 않는다. 보관 정책을 유지한 채 원인을 조사한다.

## 포함된 변경 파일

- src/app/(main)/meeting-note/page.tsx
- src/components/meetings/MeetingAudioArchive.tsx
- src/lib/meetingAudio.ts
- supabase/migrations/202610060001_meeting_audio.sql
- tests/meeting-audio.test.cjs

## 참고

- https://supabase.com/docs/guides/storage/buckets/fundamentals
- https://supabase.com/docs/guides/storage/security/access-control

## 재현 명령

압축 해제 폴더에서 다음 순서로 실행한다. 실제 Storage API 종단 간 테스트는 배포 순서에 별도로 명시했다.

```powershell
cd taskflow-recording-storage
npm ci
npm run build
node --test tests/meeting-audio.test.cjs
cd ../audio-verification
npm ci
node verify.mjs
node recorder.cjs
```
