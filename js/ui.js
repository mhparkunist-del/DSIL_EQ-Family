/* =========================================================================
 * 공통 UI: 레이아웃(헤더+사이드바) 주입, 상태 뱃지, 날짜 포맷, 토스트
 * ========================================================================= */

const MENU = [
  { href: "index.html", label: "장비예약 / 실적입력" },
  { href: "status.html", label: "장비예약현황 조회" },
  { href: "admin.html", label: "관리자 모드" },
];

const TOP_TABS = ["연구장비", "장비교육·지원", "지식재산", "학부공용장비"];

/** 현재 페이지 파일명 */
function currentPage() {
  const p = location.pathname.split("/").pop();
  return p && p.length ? p : "index.html";
}

/** 헤더 + 사이드바 레이아웃을 #app 컨테이너 앞에 주입 */
function buildLayout(activeHref) {
  const demo = !window.DSIL_CONFIG.API_URL;
  const tabs = TOP_TABS.map(
    (t, i) => `<span class="topnav__tab ${i === 0 ? "is-active" : ""}">${t}</span>`
  ).join("");
  const menu = MENU.map(
    (m) =>
      `<a class="side__item ${m.href === activeHref ? "is-active" : ""}" href="${m.href}">${m.label}</a>`
  ).join("");

  const header = document.createElement("div");
  header.innerHTML = `
    <header class="topbar">
      <div class="topbar__inner">
        <a class="brand" href="index.html">
          <img src="assets/kaist-dsil-logo.png" alt="KAIST DSIL" />
          <span class="brand__sub">장비 예약 플랫폼</span>
        </a>
        <div class="topbar__right">
          ${demo ? '<span class="demo-badge" title="API_URL 미설정: 데이터가 브라우저에만 저장됩니다">● DEMO 모드 (저장 안 됨)</span>' : '<span class="live-badge">● LIVE</span>'}
        </div>
      </div>
      <nav class="topnav"><div class="topnav__inner">${tabs}</div></nav>
    </header>
    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar__title">연구장비</div>
        ${menu}
      </aside>
      <main class="content" id="content"></main>
    </div>
    <div id="toast" class="toast"></div>
  `;
  document.body.prepend(header);
  return document.getElementById("content");
}

/** 패널(접이식 섹션) 생성 헬퍼 */
function panel(title, innerHTML) {
  return `
    <section class="panel">
      <div class="panel__head"><span>${title}</span><span class="panel__minus">—</span></div>
      <div class="panel__body">${innerHTML}</div>
    </section>`;
}

const STATUS_META = {
  available: { label: "예약가능", cls: "ok" },
  reserved: { label: "예약됨", cls: "warn" },
  in_use: { label: "사용중 🔒 실적대기", cls: "busy" },
  pending_log: { label: "🔒 실적대기", cls: "busy" },
  maintenance: { label: "점검중", cls: "muted" },
};

function statusBadge(status) {
  const m = STATUS_META[status] || { label: status, cls: "muted" };
  return `<span class="badge badge--${m.cls}">${m.label}</span>`;
}

function resvStatusLabel(s) {
  return (
    {
      reserved: "예약됨",
      in_use: "사용중",
      completed: "완료",
      cancelled: "취소",
    }[s] || s
  );
}

/** 날짜/시간 포맷 */
function fmt(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (isNaN(d)) return dt;
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtDate(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (isNaN(d)) return dt;
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 토스트 알림 */
let _toastTimer;
function toast(msg, type = "info") {
  const el = document.getElementById("toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.className = `toast toast--${type} is-show`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => (el.className = "toast"), 3200);
}

/** 빈 테이블 표시 */
function emptyRow(cols) {
  return `<tr><td class="empty" colspan="${cols}">ⓘ 해당 테이블에 데이터가 없습니다.</td></tr>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
