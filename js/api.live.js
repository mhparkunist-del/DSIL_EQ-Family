/* =========================================================================
 * 라이브 API — Google Apps Script 웹앱과 통신.
 * CORS 안전 레시피:
 *   - 읽기: 단순 GET (?action=...)  → preflight 없음
 *   - 쓰기: POST + Content-Type text/plain  → preflight 없음
 * 절대 application/json 이나 커스텀 헤더를 쓰지 말 것 (Apps Script가 못 받음).
 * ========================================================================= */
(function () {
  const cfg = window.DSIL_CONFIG;

  async function get(action, params = {}) {
    const url = new URL(cfg.API_URL);
    url.searchParams.set("action", action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    try {
      const res = await fetch(url.toString(), { method: "GET", redirect: "follow" });
      return await res.json();
    } catch (e) {
      return { ok: false, error: "네트워크 오류: " + e.message };
    }
  }

  async function post(action, payload = {}) {
    try {
      const res = await fetch(cfg.API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        redirect: "follow",
        body: JSON.stringify({ action, payload, secret: cfg.SHARED_SECRET }),
      });
      return await res.json();
    } catch (e) {
      return { ok: false, error: "네트워크 오류: " + e.message };
    }
  }

  window.apiLive = {
    isDemo: false,
    listEquipment: () => get("listEquipment"),
    listReservations: () => get("listReservations"),
    listUsageLogs: () => get("listUsageLogs"),
    listUsers: () => get("listUsers"),
    createReservation: (p) => post("createReservation", p),
    submitUsageLog: (p) => post("submitUsageLog", p),
    cancelReservation: (p) => post("cancelReservation", p),
    adminAddEquipment: (p) => post("adminAddEquipment", p),
    adminForceUnlock: (p) => post("adminForceUnlock", p),
    adminSetMaintenance: (p) => post("adminSetMaintenance", p),
    adminAddUser: (p) => post("adminAddUser", p),
    adminUpdateUser: (p) => post("adminUpdateUser", p),
    adminDeleteUser: (p) => post("adminDeleteUser", p),
    adminStats: () => get("adminStats"),
  };
})();
