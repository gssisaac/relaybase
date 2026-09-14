# 탈 Rust(Rust-to-Next.js) 마이그레이션 전략 및 Web-First 아키텍처

> **핵심 원칙: 앞으로 작성되는 99% 이상의 코드는 Next.js(TypeScript / React / Web API / Route Handlers)에서 커버한다.**  
> Rust(Tauri 백엔드)는 오직 브라우저 샌드박스를 벗어나 OS 네이티브 기능에 직접 접근해야 하는 최소한의 **Thin Shell**로만 역할을 한정한다.

---

## 1. 배경 및 목적

Relaybase는 초기에 macOS 데스크톱 앱(Tauri + Rust) 중심으로 설계되어 Cloudflare REST API 통신, 자동 설치 파이프라인, 인증 세션 관리, 데이터 저장소 등 다수의 비즈니스 로직이 Rust 백엔드(`main/desktop/src-tauri/src/`)에 작성되었습니다.

그러나 Relaybase는 **브라우저에서 직접 구동되는 웹 버전**을 동등하게 지원하며, 웹과 데스크톱이 동일한 프론트엔드(`main/app`)를 공유합니다. 이 과정에서 **AI Agent가 기존 개발 관성(Legacy Habit) 때문에 신규 기능이나 비즈니스 로직을 Rust(Tauri IPC) 특화로 작성하여 웹 버전을 깨뜨리거나 중복 코드를 양산하는 문제**가 지속해서 발생했습니다.

이를 근본적으로 해결하기 위해 **Next.js First / 탈 Rust 전략**을 정의하고, 기존 Rust 코드의 이관 대상과 유지 대상을 명확히 분리하여 번호(Numbering) 체계로 관리합니다.

---

## 2. 아키텍처 기본 방침

```
┌─────────────────────────────────────────────────────────────┐
│               Next.js App (main/app)                        │
│   • 99%+ 비즈니스 로직, UI, API 클라이언트, 상태 관리         │
│   • Web & Desktop 공통 사용 (Client + Route Handlers)        │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│      Web Environment        │ │     Desktop Environment     │
│   • Browser Web APIs        │ │     (Tauri / Rust Shell)    │
│   • Server Route Handlers   │ │   • OS Keychain / Keyring   │
│   • Cookie / Memory Auth    │ │   • Touch ID / Biometry     │
│   • Standard Fetch / SSE    │ │   • Tray / OS Notification  │
│                             │ │   • Window / OS File Open   │
└─────────────────────────────┘ └─────────────────────────────┘
```

1. **Next.js 우선 (Next.js First)**:
   - 모든 비즈니스 로직, Cloudflare API 연동, 인스톨/업데이트 파이프라인, 인증/세션 관리, 데이터 변환, UI 상태 관리는 Next.js(TypeScript)에서 단일 구현합니다.
2. **Rust의 역할 최소화 (Thin Shell Only)**:
   - Rust는 브라우저 보안 샌드박스로 인해 접근 불가능한 OS 네이티브 기능(Keyring, Touch ID, Tray, Notification, OS File Dialog, Deep Link, Window Frame)을 브릿징하는 역할로만 한정합니다.
3. **AI Agent 중복 개발 금지**:
   - 데스크톱 전용 기능이라 할지라도 OS 네이티브 API 호출이 아닌 한 Rust에 신규 invoke 커맨드를 생성하지 않습니다.

---

## 3. [M-01 ~ M-10] 옮겨져야 하는 것 (Next.js / TypeScript 이관 대상)

기존 Rust 코드에 구현되어 있으나 Next.js / TypeScript 계층으로 마이그레이션되었거나 마이그레이션해야 하는 항목들입니다.

| 번호 | 로직 / 모듈명 | 기존 Rust 위치 | Next.js 이관 대상 위치 | 마이그레이션 상태 및 가이드 |
|------|-------------|---------------|-----------------------|---------------------------|
| **M-01** | **Cloudflare REST API v4 클라이언트** | `desktop/src-tauri/src/cloudflare/client.rs` | `app/src/server/cloudflare/client.ts`<br>`app/src/lib/desktop/bridge/cloudflare.ts` | **이관 완료 및 통합 진행 중**.<br>Account ID 확인, D1 CRUD, R2 CRUD, Worker 업로드, 바인딩 설정, DNS/Email Routing API 등 모든 Cloudflare REST API 호출을 Next.js TS 클라이언트로 통합합니다. |
| **M-02** | **Worker 자동 설치(Auto Install) 및 프로브/롤백 파이프라인** | `desktop/src-tauri/src/auto_install/install.rs`<br>`auto_install/probe.rs`<br>`auto_install/rollback.rs`<br>`auto_install/routing.rs` | `app/src/app/api/install/stream/route.ts`<br>`app/src/app/api/install/probe/route.ts`<br>`app/src/app/api/install/rollback/route.ts`<br>`app/src/console/components/setup/WebInstallFlow.tsx` | **이관 완료 및 웹 우선 적용**.<br>리소스 점유 상태 확인(Probe), D1/R2 생성, 시크릿 주입, Worker 배포, 롤백 오케스트레이션을 Next.js API Routes와 SSE(Server-Sent Events) 스트림으로 일원화합니다. |
| **M-03** | **Worker 릴리즈 매니페스트 파싱 및 ZIP 압축 해제** | `desktop/src-tauri/src/auto_install/manifest.rs` | `app/src/server/cloudflare/manifest.ts`<br>`app/src/server/cloudflare/unzip.ts` | **이관 완료**.<br>GitHub Release 매니페스트(`worker-install-manifest.json`) 다운로드, 버전 비교, 배포용 ZIP 압축 해제를 Next.js 서버/브라우저 TS 라이브러리로 처리합니다. |
| **M-04** | **Worker D1 스키마 초기화 및 마이그레이션 트리거** | `desktop/src-tauri/src/auto_install/schema.rs` | `app/src/server/cloudflare/schema.ts`<br>`app/src/lib/desktop/bridge/install.ts` | **이관 완료**.<br>배포된 Worker의 `POST /console/init-db` 및 `POST /console/migrate-db` 호출과 재시도(Retry) 로직을 Next.js에서 직접 수행합니다. |
| **M-05** | **Worker HTTP 요청 프록시 (`worker_request`)** | `desktop/src-tauri/src/auth/owner_session.rs`<br>`desktop/src-tauri/src/auth/team_session.rs` | `app/src/lib/desktop/api/worker-api.ts`<br>`app/src/lib/desktop/api/email-api-map.ts` | **이관 대상 (우선순위 높음)**.<br>Rust를 거쳐 HTTP 요청을 날리던 `worker_request_cmd`를 걷어내고, 프론트엔드에서 표준 `fetch` + in-memory JWT 토큰으로 직접 Worker에 통신합니다. |
| **M-06** | **인증 세션 라이프사이클 및 JWT 상태 머신** | `desktop/src-tauri/src/auth/owner_session.rs`<br>`desktop/src-tauri/src/auth/team_session.rs`<br>`desktop/src-tauri/src/auth/worker_accounts.rs` | `app/src/lib/desktop/auth/`<br>`app/src/lib/desktop/app-session/`<br>`app/src/lib/desktop/bridge/web-owner-bridge.ts`<br>`app/src/lib/desktop/bridge/web-team-bridge.ts` | **이관 진행 중**.<br>`/console/login`, `/console/refresh-session`, `/mobile/login` 호출, 토큰 만료 갱신, 세션 상태 전이 머신을 TypeScript `AppSessionStore`로 일원화합니다. |
| **M-07** | **API Key Vault 평문 보관소 로직** | `desktop/src-tauri/src/storage/vault.rs` | `app/src/lib/desktop/vault/`<br>`worker/db/app/` (D1) | **이관 대상**.<br>API 키 관리 비즈니스 로직은 D1 및 Next.js 클라이언트에서 처리하며, 데스크톱 백엔드는 단순 로컬 파일 I/O 바인딩만 제공합니다. |
| **M-08** | **사용자 환경설정 및 메일 캐시 관리** | `desktop/src-tauri/src/storage/prefs.rs`<br>`desktop/src-tauri/src/storage/mail_store.rs` (JSON 캐시) | `app/src/lib/desktop/user-data.ts`<br>Browser IndexedDB / LocalStorage / D1 | **이관 대상**.<br>이메일 뷰어 설정(`prefs.json`), 메일 목록 캐시 등 JSON 구조체는 브라우저 표준 스토리지(IndexedDB) 또는 D1 메일 인덱스와 직접 연동합니다. |
| **M-09** | **Cloudflare OAuth 토큰 교환 및 세션 관리** | `desktop/src-tauri/src/cloudflare/oauth.rs` | `app/src/app/api/oauth/start/route.ts`<br>`app/src/app/api/oauth/callback/route.ts`<br>`app/src/server/cloudflare/session.ts` | **이관 완료**.<br>OAuth Authorization Code 교환, Refresh Token 갱신, 세션 쿠키 관리를 Next.js Route Handlers 및 안전한 Sealed Cookie로 처리합니다. |
| **M-10** | **워크스페이스 목록 및 계정 스코프 계산** | `desktop/src-tauri/src/storage/credentials.rs` (`Workspaces`) | `app/src/lib/desktop/app-session/resolve-worker-url.ts`<br>`app/src/lib/desktop/bridge/web-credentials.ts` | **이관 대상**.<br>멀티 워크스페이스 관리, 현재 활성 워크스페이스 선택, URL 정규화 로직을 TypeScript에서 전담합니다. |

---

## 4. [N-01 ~ N-10] 옮길 수 없는 것 (Rust / Tauri Thin Shell 필수 유지 항목)

웹 브라우저 샌드박스 제약으로 인해 브라우저 JS로는 **동일한 OS API를 직접 호출할 수 없습니다**. 데스크톱은 Rust Thin Shell로 네이티브에 접근하고, 웹은 **브라우저 API·Next.js Route Handler·D1** 등으로 **기능 등가(또는 의도적 생략)** 를 맞춥니다. 신규 작업 시 `app/src/lib/desktop/bridge/*`의 `isDesktopRuntime()` 분기와 아래 표를 함께 참고하세요.

| 번호 | 모듈 / 기능명 | Rust 위치 | OS 네이티브 필수 이유 및 유지 범위 | Web 버전 처리 및 현재 상태 |
|------|-------------|-----------|----------------------------------|---------------------------|
| **N-01** | **OS 보안 저장소 (Keyring / Keychain)** | `auth/keyring_store.rs` | **이유**: Passtoken·owner/team refresh·CF OAuth refresh를 OS 보안 저장소에 암호화 저장.<br>**유지**: Keyring get/set/delete 프리미티브만. | **처리**: Owner JWT → `app/src/lib/desktop/auth/owner-session.ts` **프로세스 메모리** (`mail`/`console` scope). Passtoken은 키체인 없음 — 설치/로그인 시 사용자 입력·`ownerLogin()` 후 세션만 유지 (`web-owner-bridge.ts`, `hasPasstoken: false`). CF OAuth install → 서버 **sealed httpOnly 쿠키** `rb_cf_oauth` (`server/cloudflare/session.ts`, `/api/oauth/*`). Worker 연결 메타 → `sessionStorage` `relaybase.web.credentials` (`web-credentials.ts`). Team 비밀번호 → `sessionStorage` `relaybase:email-session` + 메모리 (`email-session.ts`). API 키 평문 → `localStorage` `relaybase:api-keys-vault:v1` (`bridge/storage.ts`).<br>**상태**: ✅ 동작. ⚠️ 웹은 passtoken/refresh를 OS급 비밀이 아닌 **탭·세션 스토리지**에 두므로 데스크톱과 보안·지속성 모델이 다름. |
| **N-02** | **OS 하드웨어 생체인증 (Touch ID / Windows Hello)** | `auth/touch_id.rs`<br>`tauri-plugin-biometry` | **이유**: 키체인 읽기 전 `LocalAuthentication` 게이트.<br>**유지**: 생체 프롬프트 및 성공/실패만 반환. | **처리**: `desktopOwnerTouchId` / `desktopOwnerLoginFromKeyring`는 웹에서 **throw** (`bridge/owner.ts`). Owner 대시보드는 `DesktopDashboardGate` → `WebOwnerGate` + `hasWebOwnerSession()`으로 **AppSessionStore·Touch ID 단계 생략** (`_shell/DesktopDashboardGate.tsx`). Console 잠금 해제는 in-memory `ensureAccessToken('console')` (`web-owner-bridge.ts`).<br>**상태**: ✅ 의도적 생략(대체: passtoken 재입력·세션 메모리). 생체 UI는 데스크톱 전용. |
| **N-03** | **시스템 트레이(메뉴바) 및 미읽은 메일 뱃지** | `shell/tray.rs` | **이유**: 메뉴바/트레이 상주, Show/Quit, unread dot.<br>**유지**: 트레이 메뉴·뱃지 API. | **처리**: `setTrayUnread()` → `!isDesktopRuntime()`이면 **즉시 return** (`lib/desktop/tray.ts`).<br>**상태**: ❌ 미제공(웹에 트레이 개념 없음). 미읽음은 인앱 UI만. |
| **N-04** | **OS 네이티브 알림 센터 연동** | `shell/notify.rs` | **이유**: 백그라운드/숨김 창에서 OS 알림·클릭 시 메일 열기 (`take_pending_open_mail`).<br>**유지**: OS 알림 + 클릭 페이로드. | **처리**: `notifyNewMail()` / `useNotificationOpenMail()` → 데스크톱만 실행; 웹은 early return (`lib/desktop/notify/index.ts`). **Web Notifications API 미사용.**<br>**상태**: ❌ 미구현. 탭이 열려 있을 때만 인박스 갱신으로 대체. |
| **N-05** | **커스텀 URL 스킴 (`relaybase://`) & Loopback 서버** | `shell/deep_link.rs`<br>`cloudflare/loopback.rs` | **이유**: OAuth 후 앱 깨우기·콜백 전달.<br>**유지**: Deep link + loopback(127.0.0.1). | **처리**: `relaybase://`·loopback **없음**. CF OAuth → `/api/oauth/start`·`/api/oauth/callback` (`app/api/oauth/*`), 팝업 + `postMessage` (`web-oauth-authorize.ts`, `web-oauth-complete.ts`), 완료 후 in-app 경로(`/oauth/web-complete`). `desktopStartCfOAuth`는 웹에서 `/api/oauth/start?...` 반환 (`bridge/oauth.ts`).<br>**상태**: ✅ 동작(M-09와 동일 파이프라인). 데스크톱 deep link와 **별도** 구현. |
| **N-06** | **윈도우 라이프사이클 및 OS 프레임 제어** | `shell/window.rs`<br>`shell/commands.rs` | **이유**: Close-to-hide, Dock 재표시, 드래그 가능 타이틀바, `get_desktop_info`.<br>**유지**: 창 Show/Hide/Focus·버전 조회. | **처리**: `useDesktopChrome()` — 웹은 `isDesktop: false`, 드래그 영역·mac 타이틀바 클래스 **미적용** (`shell/use-desktop-chrome.ts`). `desktopGetInfo` / `get_desktop_info`는 Tauri 전용 (`invoke.ts`).<br>**상태**: ✅ 표준 브라우저 탭/창 동작. close-to-hide·앱 버전 표시 없음. |
| **N-07** | **OS 파일 시스템 연동 및 기본 앱 실행** | `shell/files.rs` | **이유**: Finder에서 보기, OS 기본 앱으로 열기, Downloads 저장.<br>**유지**: 쉘·파일 브릿지. | **처리**: `desktopOpenExternal` → `window.open` (`bridge/files.ts`). 첨부 **열기**는 데스크톱만 `desktopOpenAttachment`; 웹은 `<a href={blobUrl}>`·다운로드 버튼·새 탭 (`EmailShared.tsx`). `desktopSaveDownloadFile` / `reveal` / `open_file_path`는 웹에서 throw 또는 미호출.<br>**상태**: ✅ 부분 동작(다운로드·인라인 미리보기). ❌ OS 기본 앱·Finder reveal 없음. |
| **N-08** | **데스크톱 로컬 디렉토리(`~/.relaybase`) 원자적 파일 I/O** | `storage/mail_store.rs`<br>`storage/layout.rs` | **이유**: EML/바이너리 원자적 쓰기, `0700` 권한.<br>**유지**: 바이너리 I/O 프리미티브. | **처리**: `createWebStorage()` — JSON `localStorage` `relaybase:mail:v1:*`, 바이너리 **IndexedDB** `relaybase-mail-platform` (`mail-platform/storage/web-storage.ts`). 메일 캐시는 `email-disk-store.ts`가 웹에서 동일 키 레이아웃. Drafts/UI 일부는 Worker D1 **`account_state`** 동기화 (`user-ui-disk.ts`, `account-state`). `desktopGetMailJson` 등 Tauri invoke는 **데스크톱만**.<br>**상태**: ✅ 동작. ⚠️ 원자성·퍼미션·대용량 오프라인 EML은 데스크톱이 더 강함; 웹은 브라우저 quota·D1에 의존. |
| **N-09** | **WebKit 로컬 캐시 강제 초기화 (Factory Reset)** | `storage/webkit.rs` | **이유**: 공장 초기화 시 WebKit 디스크 캐시 삭제.<br>**유지**: WebKit 폴더 제거. | **처리**: `desktopClearWebkitData` / `desktopFactoryReset` → 웹에서 **no-op** 빈 문자열 반환 (`bridge/storage.ts`). `AppSessionStore.factoryReset()`은 데스크톱 세션 플로우에 묶임; 웹 owner는 `WebOwnerGate` 경로.<br>**상태**: ⚠️ 부분. 웹 전용 “공장 초기화” UI·일괄 삭제(localStorage·IDB·쿠키) **미통합** — 로그아웃·수동 스토리지 삭제로만 가능. |
| **N-10** | **데스크톱 네이티브 자동 업데이트 엔진** | `tauri-plugin-updater` | **이유**: DMG/bundle 다운로드·서명 검증·재실행.<br>**유지**: Tauri Updater. | **처리**: `AppUpdaterProvider`는 `isTauri()`일 때만 check/install (`updater/AppUpdaterContext.tsx`). 웹은 **앱 바이너리 업데이트 없음**. Worker 스크립트 업데이트는 `/settings/worker/update` → `WebInstallFlow`·`/api/install/stream` SSE (`WorkerUpdateBanner.tsx`가 웹에서 해당 경로로 라우팅).<br>**상태**: ✅ Worker 업데이트 웹 지원. ❌ Relaybase 데스크톱 DMG 자동 업데이트는 웹 해당 없음(마케팅 사이트 수동 다운로드). |

---

## 5. AI Agent 행동 강령 (Rules of Engagement)

AI Agent는 본 프로젝트에서 코드를 작성할 때 다음 규칙을 반드시 준수해야 합니다.

### ❌ 절대 하지 말아야 할 것 (Anti-Patterns)
1. **신규 비즈니스 로직을 Rust에 작성하지 마십시오**:
   - Cloudflare API 호출, 이메일 파싱/필터링, 사용자 설정 로직, 통신 로직 등을 Rust에 추가하지 마십시오.
2. **`worker_request_cmd`를 통한 Rust IPC 통신을 추가하지 마십시오**:
   - HTTP 통신은 Next.js 프론트엔드의 `desktopAwareFetch` / `workerFetch` 또는 Next.js Route Handlers에서 처리합니다.
3. **데스크톱 전용 UI/컴포넌트를 분리하여 웹 호환성을 깨뜨리지 마십시오**:
   - 모든 UI 컴포넌트는 `isDesktopRuntime()` 분기를 통해 웹(브라우저)과 데스크톱(Tauri) 모두에서 매끄럽게 동작해야 합니다.
4. **Rust 코드의 구조 변경 시 웹 버전 동작 여부를 간과하지 마십시오**.

### ✅ 반드시 준수해야 할 것 (Best Practices)
1. **Next.js 우선 개발**:
   - 기능 구현 시 항상 "웹 브라우저에서 먼저 정상 동작하는가?"를 검증하십시오.
2. **브릿지 패턴(`bridge/`) 유지**:
   - OS 네이티브 기능(Keyring, Touch ID, Tray 등)이 필요한 경우 `src/lib/desktop/bridge/` 아래에 웹 대체 구현(Web fallback)과 데스크톱 구현을 함께 정의하십시오.
3. **점진적 Rust 의존성 제거**:
   - 기존 Rust 코드(M-01 ~ M-10)를 수정하거나 관련 기능을 개선할 때, 가능한 한 Next.js 계층으로 코드를 이관하고 Rust 쪽은 레거시 래퍼 또는 최소 프리미티브로 축소하십시오.
