/* 관리자 모드 페이지 (비밀번호 0000 게이트) */
(function () {
  const content = buildLayout("admin.html");

  // ----- 비밀번호 게이트 -----
  function renderGate() {
    content.innerHTML = `
      <h1 class="page-title">관리자 모드</h1>
      ${panel("관리자 인증", `
        <form id="gateForm" class="form-row">
          <label>비밀번호
            <input id="adminPw" type="password" placeholder="관리자 비밀번호" autofocus />
          </label>
          <button class="btn btn--primary" type="submit">입장</button>
        </form>
        <p class="hint">※ 화면 가림막 용도이며 실제 보안 인증이 아닙니다.</p>`)}
    `;
    document.getElementById("gateForm").addEventListener("submit", (e) => {
      e.preventDefault();
      if (document.getElementById("adminPw").value === window.DSIL_CONFIG.ADMIN_PASSWORD) {
        renderAdmin();
      } else {
        toast("비밀번호가 올바르지 않습니다.", "error");
      }
    });
  }

  // ----- 관리자 본문 -----
  function renderAdmin() {
    content.innerHTML = `
      <h1 class="page-title">관리자 모드</h1>

      ${panel("신규 장비 등록", `
        <form id="eqForm" class="form-grid">
          <label>장비명 <input id="eName" required placeholder="장비명" /></label>
          <label>대분류 <input id="eCat" placeholder="예: 현미경" /></label>
          <label>중분류 <input id="eSub" placeholder="예: SEM" /></label>
          <label>예약지명 <input id="eLoc" placeholder="예: 1동 101호" /></label>
          <label>책임자 <input id="eMgr" placeholder="책임자" /></label>
          <label>비고 <input id="eNote" placeholder="비고 (선택)" /></label>
          <div class="form-actions"><button class="btn btn--primary" type="submit">장비 등록</button></div>
        </form>`)}

      ${panel("장비별 사용 실적 (사용 횟수)", `
        <div class="table-wrap">
          <table class="grid">
            <thead><tr><th>장비명</th><th>상태</th><th>사용 횟수</th><th>관리</th></tr></thead>
            <tbody id="statBody"></tbody>
          </table>
        </div>`)}

      ${panel("유저 권한 관리", `
        <form id="userForm" class="form-row">
          <label>이름 <input id="uName" placeholder="이름" /></label>
          <label>비번 <input id="uPw" placeholder="초기 비번" value="1234" /></label>
          <label>권한
            <select id="uRole"><option value="user">user</option><option value="admin">admin</option></select>
          </label>
          <button class="btn btn--primary" type="submit">사용자 추가</button>
        </form>
        <div class="table-wrap">
          <table class="grid">
            <thead><tr><th>이름</th><th>권한</th><th>활성</th><th>관리</th></tr></thead>
            <tbody id="userBody"></tbody>
          </table>
        </div>`)}

      ${window.api.isDemo ? `
      ${panel("데모 데이터", `
        <button class="btn" id="resetDemo">데모 데이터 초기화</button>
        <p class="hint">시드 장비/사용자로 되돌립니다. (데모 모드 전용)</p>`)}` : ""}
    `;

    wireEquipmentForm();
    wireUserForm();
    if (window.api.isDemo) {
      document.getElementById("resetDemo").addEventListener("click", async () => {
        await api.resetDemo();
        toast("데모 데이터를 초기화했습니다.", "success");
        loadStats();
        loadUsers();
      });
    }
    loadStats();
    loadUsers();
  }

  function wireEquipmentForm() {
    document.getElementById("eqForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const res = await api.adminAddEquipment({
        name: document.getElementById("eName").value,
        category: document.getElementById("eCat").value,
        subCategory: document.getElementById("eSub").value,
        location: document.getElementById("eLoc").value,
        manager: document.getElementById("eMgr").value,
        note: document.getElementById("eNote").value,
      });
      if (res.ok) {
        toast("장비가 등록되었습니다.", "success");
        document.getElementById("eqForm").reset();
        loadStats();
      } else toast(res.error, "error");
    });
  }

  async function loadStats() {
    const [sr, er] = await Promise.all([api.adminStats(), api.listEquipment()]);
    const stats = sr.ok ? sr.data : [];
    const eqMap = {};
    (er.ok ? er.data : []).forEach((e) => (eqMap[e.equipmentId] = e));
    const body = document.getElementById("statBody");
    if (!stats.length) return (body.innerHTML = emptyRow(4));
    body.innerHTML = stats
      .map((s) => {
        const e = eqMap[s.equipmentId] || {};
        const locked = s.status === "in_use" || s.status === "pending_log";
        const isMaint = s.status === "maintenance";
        return `<tr>
          <td class="strong">${escapeHtml(s.name)}</td>
          <td>${statusBadge(s.status)}</td>
          <td class="num">${s.useCount}</td>
          <td>
            ${locked ? `<button class="btn btn--sm btn--warn" data-unlock="${s.equipmentId}">강제 잠금해제</button>` : ""}
            ${!locked ? `<button class="btn btn--sm" data-maint="${s.equipmentId}" data-on="${isMaint ? "0" : "1"}">${isMaint ? "점검 해제" : "점검 전환"}</button>` : ""}
          </td>
        </tr>`;
      })
      .join("");

    body.querySelectorAll("[data-unlock]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("이 장비의 잠금을 강제로 해제할까요? (미입력 실적은 취소 처리됩니다)")) return;
        const res = await api.adminForceUnlock({ equipmentId: b.dataset.unlock });
        toast(res.ok ? "잠금을 해제했습니다." : res.error, res.ok ? "success" : "error");
        loadStats();
      })
    );
    body.querySelectorAll("[data-maint]").forEach((b) =>
      b.addEventListener("click", async () => {
        const res = await api.adminSetMaintenance({ equipmentId: b.dataset.maint, on: b.dataset.on === "1" });
        toast(res.ok ? "상태를 변경했습니다." : res.error, res.ok ? "success" : "error");
        loadStats();
      })
    );
  }

  function wireUserForm() {
    document.getElementById("userForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const res = await api.adminAddUser({
        name: document.getElementById("uName").value,
        password: document.getElementById("uPw").value,
        role: document.getElementById("uRole").value,
      });
      if (res.ok) {
        toast("사용자를 추가했습니다.", "success");
        document.getElementById("userForm").reset();
        document.getElementById("uPw").value = "1234";
        loadUsers();
      } else toast(res.error, "error");
    });
  }

  async function loadUsers() {
    const res = await api.listUsers();
    const users = res.ok ? res.data : [];
    const body = document.getElementById("userBody");
    if (!users.length) return (body.innerHTML = emptyRow(4));
    body.innerHTML = users
      .map(
        (u) => `<tr>
          <td class="strong">${escapeHtml(u.name)}</td>
          <td>
            <select data-role="${u.userId}">
              <option value="user" ${u.role === "user" ? "selected" : ""}>user</option>
              <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
            </select>
          </td>
          <td>
            <label class="switch"><input type="checkbox" data-active="${u.userId}" ${u.active ? "checked" : ""}/> <span>${u.active ? "활성" : "비활성"}</span></label>
          </td>
          <td><button class="btn btn--sm btn--warn" data-del="${u.userId}">삭제</button></td>
        </tr>`
      )
      .join("");

    body.querySelectorAll("[data-role]").forEach((s) =>
      s.addEventListener("change", async () => {
        const res = await api.adminUpdateUser({ userId: s.dataset.role, patch: { role: s.value } });
        toast(res.ok ? "권한을 변경했습니다." : res.error, res.ok ? "success" : "error");
      })
    );
    body.querySelectorAll("[data-active]").forEach((c) =>
      c.addEventListener("change", async () => {
        const res = await api.adminUpdateUser({ userId: c.dataset.active, patch: { active: c.checked } });
        toast(res.ok ? "상태를 변경했습니다." : res.error, res.ok ? "success" : "error");
        loadUsers();
      })
    );
    body.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("이 사용자를 삭제할까요?")) return;
        const res = await api.adminDeleteUser({ userId: b.dataset.del });
        toast(res.ok ? "삭제했습니다." : res.error, res.ok ? "success" : "error");
        loadUsers();
      })
    );
  }

  renderGate();
})();
