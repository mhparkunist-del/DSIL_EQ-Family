/* 장비예약 / 실적입력 페이지 */
(function () {
  const content = buildLayout("index.html");
  let equipment = [];
  let reservations = [];

  content.innerHTML = `
    <h1 class="page-title">장비예약 / 실적입력</h1>

    ${panel("조회조건", `
      <div class="form-row">
        <label>대분류
          <select id="fCategory"><option value="">전체</option></select>
        </label>
        <label>장비명
          <input id="fName" type="text" placeholder="장비명 검색" />
        </label>
        <button class="btn" id="btnSearch">🔍 조회</button>
      </div>`)}

    ${panel("장비 목록", `
      <div class="table-wrap">
        <table class="grid">
          <thead><tr>
            <th>상태</th><th>장비명</th><th>대분류</th><th>중분류</th>
            <th>예약지명</th><th>책임자</th><th>예약</th>
          </tr></thead>
          <tbody id="eqBody"></tbody>
        </table>
      </div>`)}

    ${panel("① 예약 신청", `
      <form id="resvForm" class="form-grid">
        <label>장비
          <select id="rEquipment" required></select>
        </label>
        <label>이름
          <input id="rName" type="text" placeholder="이름" required />
        </label>
        <label>비밀번호
          <input id="rPw" type="password" placeholder="비밀번호" required />
        </label>
        <label>시작 일시
          <input id="rStart" type="datetime-local" required />
        </label>
        <label>종료 일시
          <input id="rEnd" type="datetime-local" required />
        </label>
        <div class="form-actions">
          <button class="btn btn--primary" type="submit">예약하기</button>
        </div>
      </form>
      <p class="hint">※ 사용 종료 후 <b>실적을 입력해야</b> 같은 장비를 다시 예약할 수 있습니다.</p>`)}

    ${panel("② 실적 입력 (공정 후 필수)", `
      <form id="logForm" class="form-grid">
        <label>대상 예약
          <select id="lResv" required></select>
        </label>
        <label>이름
          <input id="lName" type="text" placeholder="이름" required />
        </label>
        <label>비밀번호
          <input id="lPw" type="password" placeholder="비밀번호" required />
        </label>
        <label>실제 시작
          <input id="lStart" type="datetime-local" />
        </label>
        <label>실제 종료
          <input id="lEnd" type="datetime-local" />
        </label>
        <label class="col-2">공정 / 사용 내용
          <input id="lDetail" type="text" placeholder="예: SEM 표면 관찰, 시편 5개" required />
        </label>
        <label class="col-2">결과 / 메모
          <input id="lResult" type="text" placeholder="결과 요약 (선택)" />
        </label>
        <div class="form-actions">
          <button class="btn btn--primary" type="submit">실적 제출 → 장비 잠금 해제</button>
        </div>
      </form>`)}
  `;

  async function refresh() {
    const [er, rr] = await Promise.all([api.listEquipment(), api.listReservations()]);
    equipment = er.ok ? er.data : [];
    reservations = rr.ok ? rr.data : [];
    renderCategoryFilter();
    renderTable();
    renderEquipmentSelect();
    renderResvSelect();
  }

  function renderCategoryFilter() {
    const sel = document.getElementById("fCategory");
    const cats = [...new Set(equipment.map((e) => e.category).filter(Boolean))];
    sel.innerHTML = '<option value="">전체</option>' + cats.map((c) => `<option>${escapeHtml(c)}</option>`).join("");
  }

  function filtered() {
    const cat = document.getElementById("fCategory").value;
    const name = document.getElementById("fName").value.trim();
    return equipment.filter(
      (e) => (!cat || e.category === cat) && (!name || e.name.includes(name))
    );
  }

  function renderTable() {
    const body = document.getElementById("eqBody");
    const list = filtered();
    if (!list.length) return (body.innerHTML = emptyRow(7));
    body.innerHTML = list
      .map((e) => {
        const can = e.status === "available";
        return `<tr>
          <td>${statusBadge(e.status)}</td>
          <td class="strong">${escapeHtml(e.name)}</td>
          <td>${escapeHtml(e.category)}</td>
          <td>${escapeHtml(e.subCategory)}</td>
          <td>${escapeHtml(e.location)}</td>
          <td>${escapeHtml(e.manager)}</td>
          <td>${can
            ? `<button class="btn btn--sm" data-pick="${e.equipmentId}">예약</button>`
            : `<span class="muted-txt">불가</span>`}</td>
        </tr>`;
      })
      .join("");
    body.querySelectorAll("[data-pick]").forEach((b) =>
      b.addEventListener("click", () => {
        document.getElementById("rEquipment").value = b.dataset.pick;
        document.getElementById("resvForm").scrollIntoView({ behavior: "smooth", block: "center" });
        document.getElementById("rName").focus();
      })
    );
  }

  function renderEquipmentSelect() {
    const sel = document.getElementById("rEquipment");
    const avail = equipment.filter((e) => e.status === "available");
    sel.innerHTML = avail.length
      ? avail.map((e) => `<option value="${e.equipmentId}">${escapeHtml(e.name)} (${escapeHtml(e.location)})</option>`).join("")
      : '<option value="">예약 가능한 장비가 없습니다</option>';
  }

  function renderResvSelect() {
    const sel = document.getElementById("lResv");
    const active = reservations.filter((r) => r.status === "in_use" && !r.logSubmitted);
    if (!active.length) {
      sel.innerHTML = '<option value="">실적 입력 대상 예약이 없습니다</option>';
      return;
    }
    sel.innerHTML = active
      .map((r) => {
        const e = equipment.find((x) => x.equipmentId === r.equipmentId);
        return `<option value="${r.reservationId}">${escapeHtml(e ? e.name : r.equipmentId)} — ${escapeHtml(r.userName)} (${fmt(r.startTime)})</option>`;
      })
      .join("");
  }

  document.getElementById("btnSearch").addEventListener("click", renderTable);
  document.getElementById("fName").addEventListener("input", renderTable);
  document.getElementById("fCategory").addEventListener("change", renderTable);

  document.getElementById("resvForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const res = await api.createReservation({
      equipmentId: document.getElementById("rEquipment").value,
      userName: document.getElementById("rName").value,
      password: document.getElementById("rPw").value,
      startTime: document.getElementById("rStart").value,
      endTime: document.getElementById("rEnd").value,
    });
    if (res.ok) {
      toast("예약이 완료되었습니다. 사용 후 실적 입력을 잊지 마세요!", "success");
      document.getElementById("resvForm").reset();
      refresh();
    } else toast(res.error, "error");
  });

  document.getElementById("logForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const res = await api.submitUsageLog({
      reservationId: document.getElementById("lResv").value,
      userName: document.getElementById("lName").value,
      password: document.getElementById("lPw").value,
      actualStart: document.getElementById("lStart").value,
      actualEnd: document.getElementById("lEnd").value,
      usageDetail: document.getElementById("lDetail").value,
      result: document.getElementById("lResult").value,
    });
    if (res.ok) {
      toast("실적이 제출되었습니다. 장비 잠금이 해제되었습니다.", "success");
      document.getElementById("logForm").reset();
      refresh();
    } else toast(res.error, "error");
  });

  refresh();
})();
