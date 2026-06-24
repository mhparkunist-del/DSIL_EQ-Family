/* 장비예약현황 조회 페이지 */
(function () {
  const content = buildLayout("status.html");
  let equipment = [];
  let reservations = [];

  content.innerHTML = `
    <h1 class="page-title">장비예약 현황 조회</h1>

    ${panel("장비 상태 현황", `
      <div class="table-wrap">
        <table class="grid">
          <thead><tr>
            <th>상태</th><th>장비명</th><th>대분류</th><th>예약지명</th>
            <th>현재 사용자</th><th>책임자</th>
          </tr></thead>
          <tbody id="stBody"></tbody>
        </table>
      </div>`)}

    ${panel("예약 현황", `
      <div class="form-row">
        <label>장비
          <select id="fEq"><option value="">전체</option></select>
        </label>
        <label>상태
          <select id="fStatus">
            <option value="">전체</option>
            <option value="in_use">사용중</option>
            <option value="completed">완료</option>
            <option value="cancelled">취소</option>
          </select>
        </label>
      </div>
      <div class="table-wrap">
        <table class="grid">
          <thead><tr>
            <th>상태</th><th>장비명</th><th>예약자</th><th>시작</th><th>종료</th>
            <th>실적입력</th><th>예약번호</th>
          </tr></thead>
          <tbody id="rvBody"></tbody>
        </table>
      </div>`)}
  `;

  async function refresh() {
    const [er, rr] = await Promise.all([api.listEquipment(), api.listReservations()]);
    equipment = er.ok ? er.data : [];
    reservations = rr.ok ? rr.data : [];
    renderStatusTable();
    renderEqFilter();
    renderResvTable();
  }

  function eqName(id) {
    const e = equipment.find((x) => x.equipmentId === id);
    return e ? e.name : id;
  }

  function renderStatusTable() {
    const body = document.getElementById("stBody");
    if (!equipment.length) return (body.innerHTML = emptyRow(6));
    body.innerHTML = equipment
      .map((e) => {
        const r = reservations.find((x) => x.reservationId === e.currentReservationId);
        return `<tr>
          <td>${statusBadge(e.status)}</td>
          <td class="strong">${escapeHtml(e.name)}</td>
          <td>${escapeHtml(e.category)}</td>
          <td>${escapeHtml(e.location)}</td>
          <td>${r ? escapeHtml(r.userName) : "-"}</td>
          <td>${escapeHtml(e.manager)}</td>
        </tr>`;
      })
      .join("");
  }

  function renderEqFilter() {
    const sel = document.getElementById("fEq");
    sel.innerHTML =
      '<option value="">전체</option>' +
      equipment.map((e) => `<option value="${e.equipmentId}">${escapeHtml(e.name)}</option>`).join("");
  }

  function renderResvTable() {
    const body = document.getElementById("rvBody");
    const eqId = document.getElementById("fEq").value;
    const st = document.getElementById("fStatus").value;
    const list = reservations.filter(
      (r) => (!eqId || r.equipmentId === eqId) && (!st || r.status === st)
    );
    if (!list.length) return (body.innerHTML = emptyRow(7));
    body.innerHTML = list
      .map((r) => {
        return `<tr>
          <td><span class="badge badge--${r.status === "in_use" ? "busy" : r.status === "completed" ? "ok" : "muted"}">${resvStatusLabel(r.status)}</span></td>
          <td class="strong">${escapeHtml(eqName(r.equipmentId))}</td>
          <td>${escapeHtml(r.userName)}</td>
          <td>${fmt(r.startTime)}</td>
          <td>${fmt(r.endTime)}</td>
          <td>${r.logSubmitted ? "✅ 완료" : '<span class="muted-txt">미입력</span>'}</td>
          <td class="mono">${escapeHtml(r.reservationId)}</td>
        </tr>`;
      })
      .join("");
  }

  document.getElementById("fEq").addEventListener("change", renderResvTable);
  document.getElementById("fStatus").addEventListener("change", renderResvTable);

  refresh();
})();
