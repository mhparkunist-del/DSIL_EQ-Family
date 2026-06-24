# KAIST DSIL 장비 예약 플랫폼

KAIST DSIL 공용 장비의 예약 · 사용 실적을 관리하는 웹 플랫폼입니다.
**핵심 규칙: 공정(사용) 후 실적/로그를 입력해야 같은 장비를 다시 예약할 수 있습니다.**
(실적 미입력 시 장비가 잠겨 아무도 사용할 수 없음 → 실적 누락 구조적 방지)

## 페이지

| 페이지 | 파일 | 설명 |
|--------|------|------|
| 장비예약 / 실적입력 | `index.html` | 장비 목록·예약 신청·실적 입력 |
| 장비예약현황 조회 | `status.html` | 장비 상태 + 전체 예약 현황/필터 |
| 관리자 모드 | `admin.html` | 비번 `0000`. 장비 등록, 사용 횟수, 유저 권한 관리, 강제 잠금해제 |

## 동작 방식 (2가지 모드)

- **DEMO 모드 (기본값)** — `js/config.js` 의 `API_URL` 이 비어있으면 브라우저(localStorage)에
  데이터를 저장하며 모든 화면이 동작합니다. **GitHub Pages에 올리면 바로 시연 가능**합니다.
  (단, 같은 브라우저에서만 데이터 공유 — 여러 사람 실제 공유는 LIVE 모드 필요)
- **LIVE 모드** — Google Sheets를 DB로, Google Apps Script를 API 서버로 사용합니다.
  여러 사용자가 실제로 예약을 공유합니다. 설정 방법은 [`SETUP.md`](SETUP.md) 참고.

## 기술

순수 HTML / CSS / JavaScript (빌드 과정 없음). 백엔드는 Google Apps Script(`apps-script/Code.gs`).

## 데모 계정 (DEMO 모드)

- 일반 사용자: 처음 보는 이름으로 예약하면 자동 등록됩니다. (예: 이름 `홍길동`, 비번 `1234`)
- 관리자 모드 진입 비번: `0000`

## 로컬에서 보기

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```

## 폴더 구조

```
index.html / status.html / admin.html   # 3개 페이지
css/style.css                           # KAIST DSIL 네이비 테마
js/config.js                            # 설정(오너만 수정): API_URL, 시크릿, 관리자 비번
js/api.js / api.live.js / api.demo.js   # API 어댑터(live/demo 자동 선택)
js/ui.js                                # 공통 레이아웃·뱃지·토스트
js/reserve.js / status.js / admin.js    # 페이지 로직
apps-script/Code.gs                     # Google Apps Script 백엔드(LIVE용)
SETUP.md                                # 구글 시트 + 웹앱 연동 가이드
```
