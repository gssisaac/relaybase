# Relaybase — Pre-launch 콘텐츠 & 가격 정책

- 작성일: 2026-08-09 (v1)
- **2026-08-23:** §4의 Early Access 가격표($35 / $69 / 300석)와 사이트 반영 체크리스트는 **Draft**다. 프라이빗 베타 동안 웹사이트에 올리지 않는다. 우선순위: `STRATEGY.md` §9, `PRICING.md` §0.
- 목적: 정식 유료 launch 전, **웹사이트 메시징 재포지셔닝**과 **Prelaunch(Early Access) 가격 SKU**를 내부에서 스케치한다. 숫자·포함 범위는 베타 반응 후 달라질 수 있다. 공개 확정은 유료 launch 때.
- 전제: `STRATEGY.md` §7은 내부 모델 초안, §8은 CF Email Sending 타이밍, §9는 베타 동안 가격 비공개. 이 문서 §1–3의 타깃/카피 규칙은 유효하다. §4 SKU를 사이트에 번역하는 실행은 **유료 launch 전까지 보류**한다.

---

## 1. 타깃 오디언스 재정의 (가장 중요한 변경)

### 1.1 지금까지의 포지셔닝 (바꿔야 하는 것)

현재 웹사이트(`website/src/components/*`)는 사실상 "**Google Workspace 대체 + 프로덕트 트랜잭션 이메일 API**" 프레이밍이다 — `billing@`/`support@` 같은 "사람이 아닌 주소"에 Workspace 시트를 사지 말라는 메시지, Postmark/Resend류 API 상품에 가까운 카피다.

```30:36:website/src/components/pricing-comparison.tsx
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Start free. Pay once for everything else.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Relaybase is software — not a hosted email intermediary. You pay
            Cloudflare for Email Sending; we never bill monthly for domains.
          </p>
```

이 프레이밍은 **경쟁상대가 아닌 Google Workspace를 계속 경쟁상대처럼 다루고 있다**는 문제와, **실제 제품의 핵심 가치(Mac 앱의 인박스 UX)가 카피에서 API/웹훅 뒤에 묻혀 있다**는 문제를 동시에 갖는다.

### 1.2 새 타깃 오디언스 (정확한 정의)

> **이미 Cloudflare를 쓰고 있고, Cloudflare 위에 도메인이 여러 개(멀티 도메인) 있는 사람. 그 도메인들의 메일을 Cloudflare 안에서 처리하고 싶은데(Email Routing/Sending은 이미 있음) 그걸 다룰 만한 "진짜 인박스 앱"이 없어서 못 옮기고 있는 사람. Gmail/Outlook 수준이 아니라, 빠르고 정돈된(triage 중심) 클라이언트 UI를 원하는 사람.**

이 정의에서 중요한 것:

- **Google Workspace는 경쟁상대가 아니다.** 이 타깃은 이미 Cloudflare에 정착한 사람이고, Workspace로 갈 생각도 Workspace를 쓰다가 넘어올 생각도 없다 — "Workspace보다 싸다"는 비교 자체가 이 사람들에게는 의미가 없는 축이다. (다른 세그먼트—처음 이메일 인프라를 고르는 사람—에게는 여전히 유효한 비교일 수 있지만, prelaunch 1차 타깃은 아니다.)
- **핵심 좌절 지점(pain)은 "인박스 앱의 부재"다.** Cloudflare Email Routing으로 포워딩만 걸어놓고 결국 다른 곳(개인 Gmail 등)에서 확인하거나, 여러 도메인을 계정별로 오가며 확인하는 게 지금의 현실. "API/웹훅"은 이 타깃에게는 2차 관심사다.
- **원하는 결과물의 수준**: Superhuman/Spark 같은 빠른 트리아지형 클라이언트 — 단, **마케팅 카피에서 이 앱들의 이름을 직접 언급하지 않는다** (아래 2번 정책). 묘사로 전달한다.

### 1.3 페르소나 재작성 (`use-cases.tsx` 대체안)

| 페르소나 | Pain (현재 상태) | Relaybase가 주는 것 |
|---|---|---|
| **멀티 도메인 CF 운영자** | 도메인 5~10개를 Cloudflare에 두고 Email Routing으로 그냥 포워딩만 해둠 — 실제로 관리·검색·정리할 앱이 없어서 결국 개인 Gmail 탭을 여러 개 열어놓고 확인 | 자신의 CF 계정에 설치된 Worker 하나로 모든 도메인의 메일함을 한 앱에서 — 빠른 키보드 트리아지 UI |
| **CF에 이미 있는데 이메일만 다른 데** | 도메인/DNS/Workers는 전부 Cloudflare인데 메일만 별도 서비스(Workspace, 다른 이메일 호스팅)에 있어 계정이 쪼개져 있음 | Cloudflare Email Sending/Routing으로 메일을 옮겨와 하나의 생태계로 합침 — 네임서버 이전, 새 벤더 계약 불필요 |
| **여러 제품/브랜드를 혼자 운영** | 제품마다 다른 도메인, 다른 이메일함 — 어디서 뭐가 왔는지 매번 다시 로그인해서 확인 | 하나의 앱에서 도메인별로 계정을 전환, `billing@`/`support@`까지 같은 UI 패턴 |

---

## 2. 콘텐츠 정책 — 금지 표현 & 대체 가이드

### 2.1 금지: 경쟁 앱 실명 언급

**웹사이트, 랜딩페이지, 소셜/광고 카피, 웨이트리스트 이메일 등 모든 대외 공개 콘텐츠에서 특정 상용 이메일 클라이언트의 이름을 언급하지 않는다.**

금지 목록(비배타적 — 같은 카테고리 전부 적용): Superhuman, Spark, Airmail, Newton Mail, Missive, Front, HEY, Canary Mail, Polymail, Mailbird.

- 이 규칙은 내부 전략 문서(`STRATEGY.md`, 이 문서, 디자인 벤치마크 노트)에는 적용되지 않는다 — 내부적으로 UX 기준점을 논의할 때는 계속 이름을 써도 된다. **공개 카피에만 적용.**
- 대체 표현 뱅크(그대로 재사용 가능):
  - "a fast, keyboard-first inbox"
  - "built for triage, not for scrolling"
  - "a native Mac inbox — not a browser tab"
  - "an inbox that keeps up with your keyboard"
  - "the inbox your Cloudflare domains have been missing"

### 2.2 금지: Google Workspace 비교/언급

**"경쟁상대가 아니다"는 원칙에 따라, 웹사이트 공개 페이지(hero, features, pricing, use-cases, email-addresses)에서 Google Workspace를 비교 대상으로 언급하지 않는다.**

- `pricing-comparison.tsx`의 "Google Workspace" 3번째 카드 전체를 제거 대상으로 표시(3번 섹션 체크리스트 참고).
- `site-config.ts`의 `googleWorkspace` 필드, `getGoogleWorkspaceMonthlyCost`/`getGoogleWorkspaceAnnualCost` 함수는 이 카드 제거와 함께 미사용이 되므로 정리 대상.
- `use-cases.tsx`("Workspace seat math"), `email-addresses.tsx`("Stop provisioning a Google Workspace seat for every role") 문장도 Workspace를 축으로 카피를 짜고 있으므로 재작성 대상.
- **예외**: `website/content/resources/google-workspace-vs-product-email.md`, `noreply-email-without-google-seats.md` 같은 SEO 콘텐츠 마케팅 글은 별개 트랙이다 — "Google Workspace 대안을 검색하는 다른 세그먼트"를 잡는 콘텐츠라 즉시 삭제할 필요는 없지만, **메인 랜딩 경로(홈/가격/get-started)에서 이 글들로의 링크는 걷어낸다.** 장기적으로 이 세그먼트를 계속 잡을지 여부는 별도 결정(3.6 참고).

### 2.3 허용/권장 표현

- "the client for people who already run on Cloudflare"
- "your domains are already on Cloudflare — now your inbox can be too"
- "no nameserver migration, no new vendor — just an inbox on top of what you already have"

---

## 3. 웹사이트 코드 변경 체크리스트 (실행용, 코드는 아직 미적용)

> 아래는 승인 후 그대로 실행할 diff 단위 체크리스트다. 각 항목에 현재 코드 위치와 문제, 방향을 남긴다.

### 3.1 `website/src/lib/site-config.ts`

- `description`(10행)의 `"Spark-like inbox"` → 경쟁 앱 실명 제거.

```9:10:website/src/lib/site-config.ts
  description:
    "A Mac app that wraps Cloudflare Email Sending and Routing with a Spark-like inbox and send API. Free for one domain. $69 once unlocks everything — runs entirely in your Cloudflare account.",
```

→ 예: `"A native Mac inbox for every domain you already run on Cloudflare — fast, keyboard-first, and installed as a Worker in your own account. Free for one domain. $69 once unlocks everything."`

- `googleWorkspace` 필드(66~70행) + `getGoogleWorkspaceMonthlyCost`/`getGoogleWorkspaceAnnualCost`(74~84행) — `pricing-comparison.tsx`의 Workspace 카드 제거와 함께 삭제.
- **신규 추가**: Prelaunch/Early Access 가격 필드 (4번 섹션에서 상세).

### 3.2 `website/src/components/hero.tsx`

- 79행 `"Spark-like inbox + compose"` → 경쟁 앱 실명 제거.

```76:80:website/src/components/hero.tsx
            {
              icon: MonitorSmartphone,
              title: "Mac app",
              desc: "Spark-like inbox + compose",
            },
```

→ 예: `desc: "Fast, keyboard-first inbox"`.

- 헤드라인("Product email that lives in your Cloudflare account.")은 유지 가능하지만, 1.2의 새 타깃에 맞춰 서브헤드(`siteConfig.description`)가 "billing@/API" 대신 "인박스 앱" 우선으로 읽히도록 위 3.1 변경과 함께 자연히 조정됨.

### 3.3 `website/src/components/features.tsx`

- 24행 `"Spark-like UI for every address..."` → 실명 제거.

```21:25:website/src/components/features.tsx
  {
    icon: MonitorSmartphone,
    title: "Mac app inbox",
    description:
      "Spark-like UI for every address across every domain on your Cloudflare account.",
  },
```

→ 예: `description: "A fast, keyboard-driven inbox for every address across every domain on your Cloudflare account."`

### 3.4 `website/src/app/get-started/page.tsx`

- 45행 `"Spark-like inbox UX over a routing Worker..."` → 실명 제거.

```42:46:website/src/app/get-started/page.tsx
  {
    icon: MonitorSmartphone,
    title: "Mac app + Worker",
    desc: "Spark-like inbox UX over a routing Worker you install — send API and inbound in your account.",
  },
```

→ 예: `desc: "A fast native inbox over a routing Worker you install — send API and inbound in your account."`

- 이 페이지가 이미 웨이트리스트(`WaitlistForm`) + "Free, or $X once for Pro" 카드를 갖고 있으므로, **Early Access 가격 카드로 바로 확장할 지점**이다(4.3 참고).

### 3.5 `website/src/components/pricing-comparison.tsx`

- 106행 `"Spark-like inbox, compose, and accounts UI"` → 실명 제거.
- **129~165행 "Google Workspace" 카드 전체 제거** — 3열 비교(Free/Pro/Workspace) 구조를 2열(Free/Pro) 또는 2열+Early Access 3열(4번 섹션)로 재구성.
- 상단 헤드라인/서브헤드는 Workspace를 직접 언급하지 않으므로 유지 가능.

### 3.6 `website/src/components/use-cases.tsx`

- 51행 `"without Workspace seat math"` → 제거, 1.3의 페르소나 표로 카드 3개 교체.
- 섹션 헤드라인 `"Email UX for people who already run Cloudflare"`는 새 포지셔닝과 정확히 일치 — **유지**, 오히려 이 문서의 기준 문장으로 삼는다.

### 3.7 `website/src/components/email-addresses.tsx`

- 41행 `"Stop provisioning a Google Workspace seat for every role."` → 제거/재작성.

→ 예: `"Add every address your team needs — billing@, support@, and more — without spinning up a new mailbox for each one."`

### 3.8 `website/content/resources/*` (SEO 콘텐츠, 별도 트랙)

- `google-workspace-vs-product-email.md`, `noreply-email-without-google-seats.md`, `cheapest-product-email-for-startups.md`: 메인 내비게이션/홈/가격 페이지에서의 인바운드 링크만 제거. 콘텐츠 자체는 검색 트래픽 자산이므로 즉시 삭제하지 않고 별도 결정 대상으로 보류.

---

## 4. Prelaunch 가격 정책 — Early Access SKU

### 4.1 원칙

- **Free는 그대로 유지한다.** $0, 1 Cloudflare 도메인, 1 이메일 주소 — 변경 없음.
- **Pro 정가($69 일회성, `STRATEGY.md` §7.3)는 바뀌지 않는다.** Prelaunch는 정가를 낮추는 게 아니라 **한정된 초기 인원에게 일시적으로 할인가를 여는 것**이다 — 정가 앵커링을 지금부터 지켜야 나중에 "원래도 싼 거였네"로 읽히지 않는다.
- **할인율: 정가의 약 50%.** $69 → **$35**(정확히는 49.3% 할인, 반올림해 "약 50%"로 카피).

### 4.2 SKU 표 (신규)

| SKU | 가격 | 대상 | 포함 |
|---|---|---|---|
| Free | $0 | 누구나, 지금부터 | 1 Cloudflare 도메인, 1 이메일 주소, 발신/수신, 커뮤니티 문서 |
| **Pro — Early Access** (신규, 한시) | **$35 일회성** (정가 $69의 ~50%) | 웨이트리스트에서 먼저 초대된 인원, **선착순 300명 한정** | Pro와 기능 동일(무제한 도메인/주소, Audience/Broadcasts/Metrics, Mac 앱, 팀 시트 3개) + 1년 업데이트 포함 |
| Pro (정가) | $69 일회성 | 정식 launch 이후 신규 고객 전체 | Early Access와 기능 동일 |

### 4.3 정책 — 이 가격을 어떻게 다뤄야 하는가

1. **가격 고정 약속(그랜드파더링)**: Early Access로 구매한 사람은 이후 Pro 정가가 오르든 내리든 **다시 돈을 내라는 요구를 받지 않는다** — `STRATEGY.md` §6에서 세운 "약속은 판매 전에 명문화한다" 원칙을 그대로 적용. 결제 페이지·확인 이메일에 "이 가격은 평생 고정됩니다"를 명시.
2. **마감 조건 — 인원 또는 시점 중 먼저 도달**: (a) 300명 판매 완료, 또는 (b) `STRATEGY.md` §8.5의 유료 정식 launch(Early Access 배지 제거) 시점. 마감 기준은 웹페이지에 정직하게("first 300 seats" progress 카운터) 노출 — 가짜 카운트다운·가짜 재고 부족 문구는 쓰지 않는다(브랜드 신뢰 원칙과 충돌).
3. **기능 차등 없음**: Early Access와 정가 Pro는 기능이 완전히 동일하다 — 가격만 다르다. "싼 티어는 기능도 아낀다"는 인상을 주지 않는다.
4. **연 $25 갱신 정책은 동일하게 적용**: Early Access 구매자도 1년 후 선택 갱신 $25/년 구조를 그대로 따른다(별도 우대 없음, 단순함 유지). *(선택 옵션: 얼리 서포터에게 첫 갱신을 무료로 주는 보너스도 검토 가능하지만, 이번 요청 범위("Pro보다 50% 할인")를 벗어나므로 기본안에서는 채택하지 않음 — 필요 시 별도 결정.)*
5. **CF 베타 투명 공개는 Early Access 카피에 반드시 포함**(`STRATEGY.md` §8.4): *"Built on Cloudflare's Email Sending API, currently in public beta. Early Access members get the founding price and first access to Worker updates."* — 베타라는 사실을 "리스크"가 아니라 "얼리 서포터로서의 특권"으로 프레이밍.

### 4.4 `site-config.ts` 반영 방향 (제안 — 아직 미적용)

```ts
pricing: {
  currency: "USD",
  free: { label: "Free", price: 0, domains: 1, addresses: 1 },
  pro: {
    label: "Pro",
    price: 69,
    renewalPrice: 25,
    renewalPeriodLabel: "year",
  },
  earlyAccess: {
    label: "Pro — Early Access",
    price: 35,
    seatsTotal: 300,
    /** Set false once Early Access closes (seats filled or official launch). */
    active: true,
  },
},
```

`pricing-comparison.tsx`/`get-started/page.tsx`는 `pricing.earlyAccess.active`가 `true`인 동안 Pro 카드 대신(또는 옆에) Early Access 카드를 보여주고, `$69`가 아니라 `$35`를 주 CTA 가격으로 노출한다. 정가 `$69`는 취소선으로 같이 표기해 할인폭을 시각적으로 증명한다.

---

## 5. 메시징 요약 (헤드라인 후보)

- **헤드라인**: "You already run your domains on Cloudflare. Now they can have an inbox." / "The inbox your Cloudflare domains have been missing."
- **서브헤드**: "A fast, keyboard-first Mac inbox for every domain and address you already manage on Cloudflare — installed as a Worker in your own account. Not a hosted mailbox. Not another seat-priced suite."
- **가격 CTA**: "Free for one domain. Early Access: $35 once (normally $69) — first 300 only."
- **신뢰 문구**(`STRATEGY.md` §8.4 재사용): "Built on Cloudflare's Email Sending API, currently in public beta. We track every change and ship Worker updates the same day."

---

## 6. 웨이트리스트 운영 정책

- 기존 `/get-started` 페이지의 `WaitlistForm`을 그대로 재사용 — 새 카피/가격만 얹는다(신규 컴포넌트 불필요).
- 초대 순서: 웨이트리스트 가입 시각 순으로 Early Access 300석 배정. 가입 확인 이메일에 대략적인 대기 순번 또는 "초기 300명 안에 들 가능성" 정도의 정직한 안내만 포함(과장된 긴급성 문구 지양).
- 배포 채널: Cloudflare 관련 커뮤니티(r/CloudFlare, Cloudflare Discord 커뮤니티 채널, HN "Show HN")에는 **스팸성 홍보가 아니라 빌드 로그/베타 투명성 공개 형태**로 접근 — 이 채널 자체가 정확히 1.2의 타깃 페르소나가 모이는 곳이므로 신뢰를 깨면 니치 전체에서 회복이 어렵다.

---

## 7. 실행 체크리스트

- [x] 3번 섹션의 파일별 카피 변경 적용 (`site-config.ts`, `hero.tsx`, `features.tsx`, `get-started/page.tsx`, `pricing-comparison.tsx`, `use-cases.tsx`, `email-addresses.tsx`)
- [x] `pricing-comparison.tsx` Google Workspace 카드 제거 + Early Access 카드 추가, `getGoogleWorkspace*` 함수/필드 정리(→ `getCurrentProPrice`/`isEarlyAccessActive`로 교체)
- [x] `use-cases.tsx` 페르소나 3종을 1.3 표 기준으로 교체
- [x] `site-config.ts`에 `pricing.earlyAccess` 필드 추가 (`keywords` 배열에는 원래 Workspace 키워드 없었음 — 점검 완료)
- [x] `hero.tsx`, `pricing-comparison.tsx`, `get-started/page.tsx`, `site-header.tsx`, `footer.tsx`, `resources/[slug]/page.tsx`, JSON-LD(`app/page.tsx`)를 `pricing.earlyAccess.active` 플래그 하나로 자동 전환되도록 연결 — 이 플래그를 `false`로 바꾸면 전 페이지가 정가 $69 문구로 자동 복귀(수동 카피 수정 불필요)
- [x] 60초 인트로 영상 자리에 플레이스홀더 섹션(`intro-video.tsx`) 추가, Hero 다음에 배치
- [ ] 홈/가격/get-started 내비게이션에서 Google Workspace 비교 콘텐츠(`resources/google-workspace-vs-product-email.md` 등)로의 링크 제거 — 현재 메인 내비게이션에 직접 링크가 없음을 확인(별도 조치 불필요), 다만 `/resources` 인덱스에는 계속 노출됨(3.8절 방침대로 보류)
- [ ] 실제 60초 인트로 영상 촬영/편집 후 `intro-video.tsx`의 플레이스홀더 교체
- [ ] Early Access 300석 카운터를 실데이터(웨이트리스트 전환 수)와 연동할지, 정적 문구로 유지할지 결정 — 현재는 정적 문구
- [ ] 결제 확인 이메일/영수증 카피에 "이 가격은 평생 고정" 문구 포함 확인 (Stripe 체크아웃 미구현 — 구현 시 반영)
