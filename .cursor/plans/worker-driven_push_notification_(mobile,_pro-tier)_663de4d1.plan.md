---
name: Worker-driven Push Notification (Mobile, Pro-tier)
overview: ""
todos:
  - id: firebase-setup
    content: Firebase 프로젝트 셋업 + docs/mobile-push-setup.md 작성
    status: pending
  - id: fcm-client
    content: Worker FCM HTTP v1 클라이언트 (server/src/lib/fcm.ts) — OAuth2 JWT 서명 + 토큰 캐시
    status: pending
  - id: push-subs
    content: Worker push 구독 저장 (server/src/lib/push-subscriptions.ts) — srv:push:* KV 스키마
    status: pending
  - id: tier-check
    content: Worker console tier 검증 (server/src/lib/console-tier.ts) — 5분 TTL 캐시 + console /v1/license/tier 엔드포인트
    status: pending
  - id: inbound-hook
    content: Worker inbound push 훅 (server/src/lib/inbound-push.ts + server/src/index.ts dispatchInboundEvent 확장)
    status: pending
  - id: mobile-routes
    content: Worker /mobile/push/register, unregister 라우트 (server/src/routes/mobile.ts)
    status: pending
  - id: wrangler-secrets
    content: Wrangler secret 등록 (FCM_SERVICE_ACCOUNT_JSON, CONSOLE_SERVICE_TOKEN)
    status: pending
  - id: mobile-fcm
    content: 모바일 firebase_messaging 통합 (mobile/lib/services/push_service.dart + pubspec + 권한 + 백그라운드 핸들러)
    status: pending
  - id: mobile-pro-ux
    content: 모바일 Pro 게이팅 UX (402 처리, settings Push 토글)
    status: pending
  - id: desktop-ui
    content: 데스크탑 AccountOtherDeviceView Push Pro 상태 표시 (최소)
    status: pending
  - id: docs
    content: 문서 갱신 (docs/mobile-email-companion.md, docs/storage-architecture.md)
    status: pending
isProject: false
---

# Worker-driven Push Notification (Mobile, Pro-tier)

## 개요

Worker가 inbound email 수신 시 모바일 기기로 FCM push를 주도적으로 발송. 데스크탑은 기존 20초 폴링 유지. 모바일 push는 Pro 기능으로 console.relaybase.xyz tier 검증 후 게이팅. iOS/Android 모두 FCM HTTP v1 단일 경로.

## 현재 상태

- Worker email() 핸들러 → dispatchInboundEvent() → KV enqueue + webhook 발송 (server/src/index.ts:29-38)
- 데스크탑 20초 폴링 (app/src/email/email-mailbox-store.ts:56) → GET /mail/inbox/notifications
- 모바일 45초 폴링 (mobile/lib/services/sync_service.dart) → GET /mobile/notifications
- KV srv:event:pending:{domain}:{eventId} 가 공용 이벤트 큐
- push 인프라 전무, Queues/DOs 미사용

## 목표 아키텍처

```mermaid
sequenceDiagram
  participant CF as CF Email Routing
  participant W as Worker email handler
  participant KV as KV RELAYBASE_APP
  participant Console as console.relaybase.xyz
  participant FCM as FCM HTTP v1
  participant iOS as iOS APNs
  participant And as Android FCM
  participant M as Mobile app
  CF->>W: inbound MIME
  W->>KV: enqueueInboundEvent
  W->>KV: list srv:push:device toEmail
  W->>Console: GET tier?email (cached 5m)
  Console-->>W: tier=pro
  W->>FCM: POST messages:send Bearer token
  FCM->>iOS: APNs bridge
  FCM->>And: FCM
  iOS-->>M: notification
  And-->>M: notification
  M->>W: POST /mobile/push/register fcmToken
```



## 구현 작업

### 1. Firebase 프로젝트 셋업 (문서화)

- Firebase 프로젝트 생성, FCM 활성화
- iOS: APNs Auth Key(p8) Firebase 콘솔 업로드
- Android: google-services.json → mobile/android/app/
- iOS: GoogleService-Info.plist → mobile/ios/Runner/
- Service Account JSON → Worker secret FCM_SERVICE_ACCOUNT_JSON
- 문서: docs/mobile-push-setup.md 신규 작성

### 2. Worker: FCM HTTP v1 클라이언트 — server/src/lib/fcm.ts (신규)

- getFcmAccessToken(env): service account RS256 private key(PKCS8) WebCrypto importKey → JWT 서명 → token endpoint POST → access_token
- access_token KV srv:fcm:accesstoken 캐시 (TTL 50분)
- sendFcmMessage(env, fcmToken, payload): POST [https://fcm.googleapis.com/v1/projects/{projectId}/messages:send](https://fcm.googleapis.com/v1/projects/{projectId}/messages:send), body message token notification data
- 응답 UNREGISTERED/INVALID_ARGUMENT → 무효 토큰 처리

### 3. Worker: push 구독 저장 — server/src/lib/push-subscriptions.ts (신규)

- KV 키:
  - srv:push:device:{email}:{deviceId} → platform, fcmToken, createdAt, lastSeen, active (TTL 90일)
  - srv:push:index:{email} → deviceId 배열 팬아웃 인덱스
- registerPushDevice / unregisterPushDevice / listPushDevices / markDeviceInactive

### 4. Worker: console tier 검증 — server/src/lib/console-tier.ts (신규)

- checkProTier(env, email): GET [https://console.relaybase.xyz/v1/license/tier?email={email}](https://console.relaybase.xyz/v1/license/tier?email={email}) with Authorization Bearer CONSOLE_SERVICE_TOKEN
- 결과 KV srv:tier:{email} 캐시 (TTL 5분) — 매 inbound console 호출 부하 방지
- console 측 GET /v1/license/tier 엔드포인트 추가 필요 (console.relaybase.xyz Next.js)

### 5. Worker: inbound push 훅 — server/src/lib/inbound-push.ts (신규) + server/src/index.ts 수정

- deliverPushNotifications(env, record): to 주소 → email → checkProTier → listPushDevices → 각 기기 sendFcmMessage 병렬 Promise.allSettled
- dispatchInboundEvent에 ctx.waitUntil(deliverPushNotifications) 추가 (webhook과 나란히)
- 무효 토큰 markDeviceInactive

### 6. Worker: 모바일 push 등록 라우트 — server/src/routes/mobile.ts 수정

- POST /mobile/push/register (mobile password auth): platform, fcmToken, deviceId → tier 검증(Pro 아니면 402) → registerPushDevice
- DELETE /mobile/push/register: deviceId → unregisterPushDevice
- POST /mobile/push/test (옵션): Pro 사용자 테스트 알림
- 기존 /mobile/notifications 폴링 라우트 유지(폴백)

### 7. Wrangler 설정 — server/wrangler.toml + server/customer-install/wrangler.toml

- 신규 secret: FCM_SERVICE_ACCOUNT_JSON, CONSOLE_SERVICE_TOKEN
- 신규 바인딩 불필요 (KV RELAYBASE_APP 재사용)

### 8. 모바일: FCM 통합 — mobile/

- pubspec.yaml: firebase_messaging, flutter_local_notifications 추가
- mobile/lib/services/push_service.dart (신규): 로그인 시 권한 요청, FCM 토큰 획득, POST /mobile/push/register, onTokenRefresh 재등록, 백그라운드 핸들러 local notification + inbox 캐시 무효화
- mobile/lib/providers/auth_provider.dart: 로그인 후 pushService.register
- mobile/lib/services/sync_service.dart: push 활성 시 폴링 45s → 5분 연장, 폴백 유지
- iOS Info.plist: UIBackgroundModes remote-notification
- Android AndroidManifest.xml: FOREGROUND_SERVICE + 알림 채널

### 9. 모바일: Pro 게이팅 UX

- POST /mobile/push/register 402 → "Push는 Pro 기능" 업그레이드 안내
- mobile/lib/screens/settings_screen.dart: Push 토글 + Pro 배지

### 10. 데스크탑: 최소 UI 반영

- app/src/dashboard/components/AccountOtherDeviceView.tsx: "Push notifications (Pro)" 상태 표시
- 데스크탑 자체 폴링/알림 변경 없음

### 11. 문서 갱신

- docs/mobile-email-companion.md: push 섹션 추가 (Pro, FCM, 폴백 폴링)
- docs/storage-architecture.md: srv:push:*, srv:tier:*, srv:fcm:accesstoken 키 패밀리 추가
- docs/mobile-push-setup.md 신규: Firebase 셋업, secret 등록, 인증 흐름

## 핵심 설계 결정

- FCM 통합: Worker는 FCM HTTP v1만 호출, iOS는 FCM이 APNs 브릿지
- 데스크탑 폴링 유지: 리스크 최소화, Tauri 로컬 알림 그대로
- Pro tier: 매 push console 호출 부하 → 5분 TTL KV 캐시(srv:tier:{email}) 권장, tier 만료 정리는 기존 15분 cron에 추가
- 폴백 폴링: 모바일 폴링 제거 않고 간격 연장, push 누락/지연 보완
- 무효 토큰 정리: FCM UNREGISTERED 응답 시 markDeviceInactive → 90일 후 TTL 만료
- 서비스 인증: product Worker ↔ console shared secret CONSOLE_SERVICE_TOKEN (향후 mTLS/JWT 강화 가능)

## 리스크/한계

- FCM 의존성: Firebase 장애 시 push 중단 (폴백 폴링으로 커버)
- console tier 캐시 5분: Pro 만료 후 최대 5분 추가 push 가능 (허용 범위)
- console 엔드포인트 신규 추가 필요: GET /v1/license/tier (console.relaybase.xyz Next.js 라우트)



## 해당 플랜은 지금 수행하기에 스팩이 너무 크므로 일단 보류

