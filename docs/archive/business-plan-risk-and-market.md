# Relaybase 사업 계획 리포트 — 리스크 제거 및 시장 확장 전략

- 작성일: 2026-08-03
- 작성 범위: 현재 코드베이스 아키텍처 진단, 사업 리스크 분석, 시장 재평가, 단계별 실행 전략
- 결론 요약: **철회하지 않는다. 지금 구조로 그대로 확장하지도 않는다. "1단계 리스크 제거 → 2단계 시장 확장"의 단계적 진행을 추천한다.**

---

## 1. Executive Summary

Relaybase는 "제품마다 필요한 이메일(billing@, support@, no-reply@ 등)을 도메인당 $10/월 정액에 제공"하는 트랜잭셔널 + 수신 이메일 인프라 제품이다. Google Workspace 대비 가격 경쟁력이 명확하고, ImprovMX·Forward Email·Postmark 같은 실제로 수익을 내는 경쟁사가 존재한다는 점에서 **시장 자체는 검증된 영역**이다.

그러나 현재 구현은 다음 두 가지 구조적 문제를 안고 있다.

1. **시장이 스스로 좁아지는 구조**: 이메일 발송/수신 전체를 Cloudflare Email Routing/Sending API 하나에 의존하고 있어, 고객이 도메인 네임서버를 Cloudflare로 위임해야만 제품을 쓸 수 있다. 이는 "멀티 프로덕트 빌더"라는 타깃 자체의 한계가 아니라, 기술 선택이 만든 인위적인 진입장벽이다.
2. **사업 존속을 위협하는 구조적 리스크**: 모든 테넌트(고객)가 **단 하나의 Cloudflare 계정**을 공유해서 이메일을 발송한다. 남용 방지 장치(속도 제한, 콘텐츠 검사, 이상 탐지)가 코드상 전혀 구현되어 있지 않다. 테넌트 한 명이 스팸/피싱을 보내면 Cloudflare가 계정 전체의 Email Sending을 정지시킬 수 있고, 이 경우 모든 테넌트의 서비스가 동시에 중단된다.

이 리포트는 이 두 문제를 분리해서, **"살릴 가치가 있는 사업 아이디어"와 "지금 당장 고쳐야 할 위험한 구현"**을 구분하고, 실행 가능한 단계별 로드맵을 제시한다.

---

## 2. 현재 아키텍처 진단 (코드 근거)

### 2.1 이메일 발송 — 단일 Cloudflare 계정 공유 구조

모든 테넌트의 발송 요청은 API 키 인증만 통과하면 **서버 전역에 하나뿐인** Cloudflare `accountId`/`apiToken`으로 처리된다.

```44:55:server/src/lib/cloudflare-config.ts
export async function createCloudflareClient(env: Env): Promise<CloudflareClient> {
  const config = await readCloudflareRuntimeConfig(env);
  if (!config) {
    throw new Error(
      "Cloudflare Email Sending is not configured on this worker — set account ID and API token in the ops-dashboard Relaybase settings",
    );
  }
  return new CloudflareClient({
    accountId: config.accountId,
    apiToken: config.apiToken,
  });
}
```

`server/src/routes/send.ts`는 테넌트별 자격증명을 조회하는 로직이 전혀 없으며, `EmailConfig`에 존재하는 `credentialSource: "integration" | "manual"` 필드도 실제 발송 경로(`send.ts`)와 DNS 자동화 경로(`app/src/lib/relaybase/branding.ts`)에서 전혀 참조되지 않는다. 즉 "본인 Cloudflare 계정을 연결한다"는 옵션은 현재 UI 상 껍데기만 있고 기능적으로 미구현 상태다.

### 2.2 남용 방지 장치 — 전무

`server/src` 전체에서 `rate limit`, `throttle`, `quota`, `abuse` 관련 코드를 검색한 결과 **0건**이었다. `server/src/lib/keys.ts`는 API 키 생성·검증·회수(revoke)만 제공하며, 발송량 상한이나 이상 탐지, 사전 차단 로직이 없다. `server/src/lib/send-logs.ts`는 사후 로그 기록만 수행한다.

### 2.3 BIMI/DMARC 자동화가 요구하는 전제 조건

`_dmarc.<domain>`, `default._bimi.<domain>` 같은 TXT 레코드는 해당 도메인의 **권위 네임서버**가 응답해야 한다. Cloudflare API로 이를 자동으로 써넣으려면 그 도메인의 Zone이 Relaybase가 쓰는 Cloudflare 계정 안에 실제로 존재해야 한다(부분/CNAME 연결로는 불가능). Email Routing/Sending API 역시 Zone/Account 스코프 API이므로 동일한 전제가 필요하다.

**결론**: 지금 구조에서 고객은 반드시 "도메인 네임서버를 Cloudflare로 위임"해야 하며, 이는 경쟁사(ImprovMX, Forward Email, Postmark 등 — 자체 메일 인프라와 자체 DKIM을 사용하여 기존 DNS 제공자에 레코드 몇 개만 추가하면 되는 방식) 대비 명백한 진입장벽이다.

### 2.4 제품이 실제로 상업화를 목표로 설계되어 있음을 보여주는 근거

```1:8:website/src/lib/site-config.ts
export const siteConfig = {
  name: "Relaybase",
  tagline: "Every product email. One flat price.",
  description:
    "Spin up billing, support, privacy, no-reply, hello, and admin addresses for every product you ship — send and receive with a few lines of code. $10/month per domain. Built on Cloudflare.",
```

`website/src/components/use-cases.tsx`는 "1인 빌더 / 멀티 프로덕트 운영자 / 플랫폼·운영팀" 세 페르소나를 명시하고 있어, 이 제품이 운영자 본인의 도메인뿐 아니라 **외부 고객에게 판매**하는 것을 전제로 설계되었음을 확인할 수 있다.

---

## 3. 리스크 분석

### 3.1 사용자측 리스크 (Cloudflare → Relaybase)

| 리스크 | 가능성 | 근거 |
|---|---|---|
| Cloudflare가 남용 신고 누적 시 계정(=Relaybase 전체) 정지 | 중~높음 | Cloudflare Email Sending은 트랜잭셔널/알림 용도 전제, 대량 발송 시 ToS 마찰 가능 |
| Cloudflare Email Sending 자체의 제품 성숙도/지속가능성 | 중 | Workers·R2 대비 신규 제품, 우선순위·스펙 변경 가능성 |
| 벤더 락인 | 높음 | `CloudflareClient`가 추상화 계층 없이 직결되어 있어 전환 비용 큼 |

### 3.2 운영자(Isaac)측 리스크 — 핵심 리스크

- **단일 실패점(SPOF)**: 모든 테넌트의 발송이 하나의 `accountId`로 이뤄지므로, 테넌트 한 명의 남용이 **전체 테넌트의 동시 서비스 중단**으로 이어질 수 있다.
- **DNS 리스크 전이**: 테넌트 도메인의 Zone 전체(웹사이트 라우팅 포함)가 같은 Cloudflare 계정에 있는 경우, 이메일 정지가 그 도메인의 웹사이트 가용성까지 위협할 수 있다.
- **방어장치 부재**: 발송량 상한, 콘텐츠 검사, 반송률/신고율 기반 자동 차단이 전혀 없어, 문제가 실제로 발생하기 전까지 리스크가 눈에 보이지 않는 구조다(테넌트 수가 늘어날수록 발생 확률은 선형 이상으로 증가).

### 3.3 리스크 매트릭스

| 리스크 | 발생 시 영향 범위 | 현재 방어 수준 | 우선순위 |
|---|---|---|---|
| 테넌트발 스팸/피싱 → 계정 전체 정지 | 전체 테넌트 동시 중단 | 없음 | **긴급** |
| Cloudflare 정책/가격 변경 | 사업 모델 붕괴 가능 | 없음(단일 벤더 의존) | 높음 |
| Cloudflare NS 위임 요구로 인한 시장 축소 | 성장 한계 | 없음(구조적) | 높음 |
| 토큰 유출 시 다중 테넌트 DNS 동시 훼손 | 다중 테넌트 | 없음 | 중간 |

---

## 4. 시장 재평가

### 4.1 "시장이 작다"는 진단의 재해석

당초 우려("Cloudflare로 도메인을 관리하는 사람 + 멀티 프로덕트 빌더로 좁히면 시장이 너무 작다")는 **부분적으로만 타당**하다. 좁은 것은 "멀티 프로덕트 빌더"라는 타깃 페르소나가 아니라, "Cloudflare Email 제품에 의존"하기로 한 기술적 선택이다.

- **현재 구조의 실질 시장**: 이미 Cloudflare로 네임서버를 위임한(또는 위임할 의향이 있는) 도메인 소유자 중, 멀티 프로덕트/에이전시 운영자. 규모가 작고, 자기잠식적(self-limiting)이다.
- **탈-Cloudflare-의존 구조의 잠재 시장**: "Google Workspace보다 싸고 코드 친화적인 비즈니스 이메일을 원하는 모든 도메인 소유자". 이는 ImprovMX/Postmark/Resend가 이미 실제 매출로 증명한 훨씬 큰 시장이다.

### 4.2 가격 모델과의 연결

$10/월 정액 가격은 Cloudflare Email Sending의 저비용/무료에 가까운 구조 덕분에 가능하다. 발송 백엔드를 SES/Postmark 등으로 다변화하면 발송당 실비용이 발생하므로, 가격 재설계가 필요해진다. 이는 시장 확장과 가격 정책이 트레이드오프 관계에 있음을 의미한다.

---

## 5. 전략적 옵션 비교

| | A. 철회 | B. 현행 유지 확장 | C. 리스크 제거 후 진행 (추천) |
|---|---|---|---|
| 시장 크기 | 0 | 작음(Cloudflare NS 위임자 한정) | Workspace 대체 수요 전체로 확장 가능 |
| 조직 존속 리스크 | 해당 없음 | 매우 높음(방어장치 0건) | 크게 완화 |
| $10/월 정액가 유지 | 무관 | 유지 가능 | 재설계 필요(2단계 시점) |
| 필요 작업량 | 없음 | 없음(그대로 오픈) | 1단계: 소규모 / 2단계: 중~대규모 |
| "Built on Cloudflare" 마케팅 | 폐기 | 유지 | 톤 다운/재포지셔닝 필요 |
| 근거 | 시장 검증 사례 존재(경쟁사) → 철회 근거 약함 | 방어장치 부재로 사업 존속 리스크 과도 | 시장 확장 + 리스크 완화 동시 달성 |

**판단**: A(철회)는 이미 검증된 인접 시장이 존재하므로 근거가 약하다. B(현행 유지 확장)는 남용 방지 장치가 전혀 없는 상태로 테넌트를 늘리는 것이므로, 사고가 "일어날지"가 아니라 "언제 일어날지"의 문제다. **C(리스크 제거 후 진행)를 추천한다.**

---

## 6. 추천 전략: 단계별 실행 계획

### Phase 0 — 즉시 (오픈 전 필수, 착수 기간 목표: 1~2주)

목표: 지금 구조를 유지한 채로 "한 명이 전체를 마비시키는" 최악의 시나리오를 차단한다.

1. **테넌트별 발송량 상한(rate limit)**: API 키(도메인) 단위로 일/시간당 발송 건수 캡. Cloudflare 자체 한도에 도달하기 전에 선제적으로 차단.
2. **테넌트별 자동 서킷 브레이커**: 반송률(bounce rate)/신고율이 임계치를 넘으면 **해당 테넌트만** 자동 정지(전체 계정이 아니라). `server/src/lib/send-logs.ts`에 이미 로그 기록 인프라가 있으므로, 여기에 집계 + 임계치 판단 로직을 추가하는 방식으로 구현 가능.
3. **최소 콘텐츠 검사**: 발송 전 명백한 피싱 패턴(단축 URL 과다, 알려진 피싱 키워드, 첨부 실행파일 등) 사전 필터링.
4. **셀프서비스 가입 잠정 중단, 승인제 온보딩**: 초기 고객(당신 자신의 여러 프로덕션 도메인 포함)을 직접 승인하여 트랙레코드를 쌓는 동안 무분별한 확산을 방지.
5. **"manual" 자격증명 옵션 실제 구현**: 원하는 고객이 자신의 Cloudflare 계정/토큰을 연결해 완전히 격리된 발송을 할 수 있도록 `credentialSource` 토글을 실제로 동작시킨다(현재는 UI만 존재).

완료 기준(Go 조건): 테넌트 단위 자동 차단이 실제로 동작함을 시뮬레이션으로 검증, 승인제 온보딩 프로세스 문서화.

### Phase 1 — 검증 (목표 기간: 4~8주, Phase 0 이후)

목표: 소수의 신뢰 가능한 고객(자기 자신의 프로덕트들 포함)으로 실제 운영 데이터를 쌓아 Phase 0 방어장치의 실효성을 확인한다.

1. 5~10개 도메인 규모로 승인제 운영, Cloudflare 발송 상태·반송률 모니터링 체계화.
2. `EmailSettingsLimitsView`(이미 존재하는 Sending limits & status 화면)를 운영 대시보드로 확장하여 이상 징후를 조기 발견.
3. Cloudflare 계정 정지 시나리오에 대한 **컨틴전시 플랜** 문서화(대체 발송 채널로 얼마나 빨리 전환 가능한지 사전 점검).

완료 기준(Go 조건): 8주간 계정 정지/심각한 신고 사고 0건, 최소 2개 이상 외부(비-Isaac) 고객으로부터 긍정적 피드백 확보.

### Phase 2 — 시장 확장 (Phase 1 통과 후 착수, 중~대규모 작업)

목표: "Cloudflare 필수" 제약을 제거하여 실질 시장을 Workspace 대체 수요 전체로 확장한다.

1. **DNS 자동화의 선택적 패스트패스화**: 도메인이 이미 Cloudflare에 있으면 자동화(현재 방식), 아니면 표준 SPF/DKIM/MX/BIMI 레코드를 안내하는 "복붙 설정" 플로우 제공(이전 논의에서 다룬 매뉴얼 DNS 안내 UX).
2. **발송 백엔드 추상화 계층 도입**: `CloudflareClient`를 인터페이스로 감싸 SES/Postmark/Resend 등으로 교체·이중화 가능하도록 리팩터링. 벤더 리스크 완화 및 발송 인프라의 테넌트별 격리(가능하다면 서브계정/전용 발송 도메인) 실현.
3. **가격 모델 재설계**: 발송당 실비용을 반영한 티어 설계(예: 소용량 정액 + 초과분 종량제), Google Workspace 대비 여전한 가격 우위 유지 검증.
4. **마케팅 재포지셔닝**: "Built on Cloudflare"를 구현 디테일로 격하하고, "어떤 DNS 제공자를 쓰든 동작하는 제품 이메일 인프라"로 메시지 전환.

완료 기준(Go 조건): 신규 아키텍처로 Cloudflare 미사용 도메인 온보딩 E2E 테스트 통과, 재설계된 가격 모델의 유닛 이코노믹스 검증.

---

## 7. Go / No-Go 요약

| 단계 | Go 조건 | No-Go 시 대응 |
|---|---|---|
| Phase 0 → Phase 1 | 테넌트 단위 자동 차단 동작 확인 | 셀프서비스 오픈 보류, 방어장치 보강 |
| Phase 1 → Phase 2 | 8주 무사고 + 외부 고객 검증 | 승인제 유지, 추가 모니터링 기간 연장 |
| Phase 2 → 전면 확장 | 비-Cloudflare 온보딩 E2E 검증 + 유닛 이코노믹스 검증 | 니치 시장(Cloudflare 사용자)에 한정해 유지 |

---

## 8. 결론

Relaybase의 사업 아이디어("멀티 프로덕트를 위한 저렴하고 코드 친화적인 이메일 인프라")는 인접 경쟁사들의 존재로 시장성이 검증되어 있다. 문제는 아이디어가 아니라 **"Cloudflare Email 제품에 전면적으로 의존한 구현"**이 (1) 시장을 스스로 좁히고 (2) 방어장치 없는 단일 계정 공유 구조로 사업 존속을 위협한다는 점이다.

따라서 철회보다는, **Phase 0(즉시 리스크 제거) → Phase 1(소규모 검증) → Phase 2(시장 확장)**의 단계적 진행을 추천한다. 이 경로는 초기 투자를 최소화하면서 사업 존속 리스크를 먼저 제거하고, 검증된 이후에만 더 큰 투자(발송 백엔드 다변화, 가격 재설계)를 집행하는 리스크 관리형 접근이다.
