/* =========================================================================
 * KAIST DSIL 장비 예약 플랫폼 — Google Apps Script 백엔드 (API 서버)
 * 이 코드를 Google Sheet에 연결된 Apps Script 편집기에 붙여넣고 웹앱으로 배포합니다.
 * 자세한 절차: 저장소의 SETUP.md 참고.
 *
 * 시트 탭(4개): Equipment / Users / Reservations / UsageLogs
 * 각 탭의 1행은 헤더(컬럼명)여야 합니다. (스키마는 SETUP.md 참고)
 *
 * Script Properties (파일 > 프로젝트 설정 > 스크립트 속성):
 *   SHARED_SECRET = 프론트 config.js 의 SHARED_SECRET 과 동일한 값
 *   SALT          = 비밀번호 해시용 임의 문자열
 * ========================================================================= */

const SHEETS = {
  equipment: "Equipment",
  users: "Users",
  reservations: "Reservations",
  logs: "UsageLogs",
};

/* ----------------------------- 라우팅 ----------------------------- */
function doGet(e) {
  return route((e.parameter || {}).action, e.parameter || {}, false);
}
function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: "잘못된 요청 형식" });
  }
  return route(body.action, body.payload || {}, true, body.secret);
}

function route(action, payload, isWrite, secret) {
  try {
    // 읽기 (인증 불필요)
    switch (action) {
      case "listEquipment": return json({ ok: true, data: readTable(SHEETS.equipment) });
      case "listReservations": return json({ ok: true, data: readTable(SHEETS.reservations) });
      case "listUsageLogs": return json({ ok: true, data: readTable(SHEETS.logs) });
      case "listUsers": return json({ ok: true, data: stripPw(readTable(SHEETS.users)) });
      case "adminStats": return json({ ok: true, data: computeStats() });
    }

    // 쓰기 — 시크릿 검증 + 락
    const need = PropertiesService.getScriptProperties().getProperty("SHARED_SECRET");
    if (need && secret !== need) return json({ ok: false, error: "unauthorized" });

    return withLock(function () {
      switch (action) {
        case "createReservation": return json(createReservation(payload));
        case "submitUsageLog": return json(submitUsageLog(payload));
        case "cancelReservation": return json(cancelReservation(payload));
        case "adminAddEquipment": return json(adminAddEquipment(payload));
        case "adminForceUnlock": return json(adminForceUnlock(payload));
        case "adminSetMaintenance": return json(adminSetMaintenance(payload));
        case "adminAddUser": return json(adminAddUser(payload));
        case "adminUpdateUser": return json(adminUpdateUser(payload));
        case "adminDeleteUser": return json(adminDeleteUser(payload));
        default: return json({ ok: false, error: "알 수 없는 action: " + action });
      }
    });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ----------------------------- 동시성 ----------------------------- */
function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

/* ----------------------------- 시트 헬퍼 ----------------------------- */
function sheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}
function readTable(name) {
  const sh = sheet(name);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map(function (row) {
    const obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  }).filter(function (o) { return o[headers[0]] !== "" && o[headers[0]] != null; });
}
function appendRow(name, obj) {
  const sh = sheet(name);
  const headers = sh.getDataRange().getValues()[0];
  sh.appendRow(headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ""; }));
}
function findRowIndex(name, idCol, idVal) {
  const sh = sheet(name);
  const values = sh.getDataRange().getValues();
  const col = values[0].indexOf(idCol);
  for (var i = 1; i < values.length; i++) if (String(values[i][col]) === String(idVal)) return i + 1; // 1-based
  return -1;
}
function updateCell(name, rowIndex, col, val) {
  const sh = sheet(name);
  const headers = sh.getDataRange().getValues()[0];
  sh.getRange(rowIndex, headers.indexOf(col) + 1).setValue(val);
}
function getRowObj(name, rowIndex) {
  const sh = sheet(name);
  const headers = sh.getDataRange().getValues()[0];
  const row = sh.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const obj = {};
  headers.forEach(function (h, i) { obj[h] = row[i]; });
  return obj;
}
function nowIso() { return Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd'T'HH:mm:ss"); }
function genId(prefix) { return prefix + new Date().getTime() + Math.floor(Math.random() * 1000); }

/* ----------------------------- 인증 ----------------------------- */
function hashPw(pw) {
  const salt = PropertiesService.getScriptProperties().getProperty("SALT") || "";
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw + salt);
  return raw.map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join("");
}
function authUser(name, password) {
  name = (name || "").toString().trim();
  if (!name) return { error: "이름을 입력하세요." };
  const users = readTable(SHEETS.users);
  let u = null;
  for (var i = 0; i < users.length; i++) if (users[i].name === name) { u = users[i]; break; }
  if (!u) {
    // 자동 등록 (데모/초기 편의) — 운영에서 막으려면 여기서 error 반환
    const nu = { userId: genId("U"), name: name, passwordHash: hashPw(password || ""), role: "user", active: true, email: "", createdAt: nowIso() };
    appendRow(SHEETS.users, nu);
    return { user: nu };
  }
  if (u.passwordHash && u.passwordHash !== hashPw(password || "")) return { error: "비밀번호가 일치하지 않습니다." };
  if (u.active === false || u.active === "FALSE") return { error: "비활성화된 계정입니다." };
  return { user: u };
}
function stripPw(users) {
  return users.map(function (u) { var c = {}; for (var k in u) if (k !== "passwordHash") c[k] = u[k]; return c; });
}

/* ----------------------------- 비즈니스 로직 ----------------------------- */
function createReservation(p) {
  const a = authUser(p.userName, p.password);
  if (a.error) return { ok: false, error: a.error };
  const ri = findRowIndex(SHEETS.equipment, "equipmentId", p.equipmentId);
  if (ri < 0) return { ok: false, error: "장비를 찾을 수 없습니다." };
  const e = getRowObj(SHEETS.equipment, ri); // 락 안에서 최신 상태 재조회
  if (e.status === "maintenance") return { ok: false, error: "점검중인 장비입니다." };
  if (e.status !== "available") return { ok: false, error: "사용할 수 없는 장비입니다. (이전 사용자의 실적 입력 필요)" };
  if (!p.startTime || !p.endTime) return { ok: false, error: "예약 시간을 입력하세요." };

  const r = {
    reservationId: genId("R"), equipmentId: p.equipmentId, userName: a.user.name,
    startTime: p.startTime, endTime: p.endTime, status: "in_use", logSubmitted: false, createdAt: nowIso(),
  };
  appendRow(SHEETS.reservations, r);
  updateCell(SHEETS.equipment, ri, "status", "in_use");
  updateCell(SHEETS.equipment, ri, "currentReservationId", r.reservationId);
  updateCell(SHEETS.equipment, ri, "updatedAt", nowIso());
  return { ok: true, data: r };
}

function submitUsageLog(p) {
  const a = authUser(p.userName, p.password);
  if (a.error) return { ok: false, error: a.error };
  const ri = findRowIndex(SHEETS.reservations, "reservationId", p.reservationId);
  if (ri < 0) return { ok: false, error: "예약을 찾을 수 없습니다." };
  const r = getRowObj(SHEETS.reservations, ri);
  if (r.userName !== a.user.name) return { ok: false, error: "본인의 예약만 실적 입력이 가능합니다." };
  if (r.logSubmitted === true || r.logSubmitted === "TRUE") return { ok: false, error: "이미 실적이 입력된 예약입니다." };
  if (!p.usageDetail) return { ok: false, error: "공정/사용 내용을 입력하세요." };

  appendRow(SHEETS.logs, {
    logId: genId("L"), reservationId: r.reservationId, equipmentId: r.equipmentId, userName: a.user.name,
    actualStart: p.actualStart || r.startTime, actualEnd: p.actualEnd || r.endTime,
    usageDetail: p.usageDetail, result: p.result || "", createdAt: nowIso(),
  });
  updateCell(SHEETS.reservations, ri, "status", "completed");
  updateCell(SHEETS.reservations, ri, "logSubmitted", true);
  const ei = findRowIndex(SHEETS.equipment, "equipmentId", r.equipmentId);
  if (ei > 0) {
    updateCell(SHEETS.equipment, ei, "status", "available");
    updateCell(SHEETS.equipment, ei, "currentReservationId", "");
    updateCell(SHEETS.equipment, ei, "updatedAt", nowIso());
  }
  return { ok: true, data: { logged: true } };
}

function cancelReservation(p) {
  const a = authUser(p.userName, p.password);
  if (a.error) return { ok: false, error: a.error };
  const ri = findRowIndex(SHEETS.reservations, "reservationId", p.reservationId);
  if (ri < 0) return { ok: false, error: "예약을 찾을 수 없습니다." };
  const r = getRowObj(SHEETS.reservations, ri);
  if (r.userName !== a.user.name) return { ok: false, error: "본인의 예약만 취소할 수 있습니다." };
  if (r.logSubmitted === true || r.logSubmitted === "TRUE") return { ok: false, error: "완료된 예약은 취소할 수 없습니다." };
  updateCell(SHEETS.reservations, ri, "status", "cancelled");
  const ei = findRowIndex(SHEETS.equipment, "equipmentId", r.equipmentId);
  if (ei > 0 && String(getRowObj(SHEETS.equipment, ei).currentReservationId) === String(r.reservationId)) {
    updateCell(SHEETS.equipment, ei, "status", "available");
    updateCell(SHEETS.equipment, ei, "currentReservationId", "");
  }
  return { ok: true, data: r };
}

/* ----------------------------- 관리자 ----------------------------- */
function adminAddEquipment(p) {
  if (!p.name) return { ok: false, error: "장비명을 입력하세요." };
  const e = {
    equipmentId: genId("EQ"), name: p.name, category: p.category || "", subCategory: p.subCategory || "",
    location: p.location || "", status: "available", currentReservationId: "", manager: p.manager || "",
    note: p.note || "", updatedAt: nowIso(),
  };
  appendRow(SHEETS.equipment, e);
  return { ok: true, data: e };
}
function adminForceUnlock(p) {
  const ei = findRowIndex(SHEETS.equipment, "equipmentId", p.equipmentId);
  if (ei < 0) return { ok: false, error: "장비를 찾을 수 없습니다." };
  const e = getRowObj(SHEETS.equipment, ei);
  if (e.currentReservationId) {
    const ri = findRowIndex(SHEETS.reservations, "reservationId", e.currentReservationId);
    if (ri > 0) {
      const r = getRowObj(SHEETS.reservations, ri);
      if (!(r.logSubmitted === true || r.logSubmitted === "TRUE")) updateCell(SHEETS.reservations, ri, "status", "cancelled");
    }
  }
  updateCell(SHEETS.equipment, ei, "status", "available");
  updateCell(SHEETS.equipment, ei, "currentReservationId", "");
  updateCell(SHEETS.equipment, ei, "updatedAt", nowIso());
  return { ok: true, data: { unlocked: true } };
}
function adminSetMaintenance(p) {
  const ei = findRowIndex(SHEETS.equipment, "equipmentId", p.equipmentId);
  if (ei < 0) return { ok: false, error: "장비를 찾을 수 없습니다." };
  const e = getRowObj(SHEETS.equipment, ei);
  if (p.on && e.status === "in_use") return { ok: false, error: "사용중인 장비는 점검 전환할 수 없습니다." };
  updateCell(SHEETS.equipment, ei, "status", p.on ? "maintenance" : "available");
  return { ok: true, data: { status: p.on ? "maintenance" : "available" } };
}
function adminAddUser(p) {
  if (!p.name) return { ok: false, error: "이름을 입력하세요." };
  const users = readTable(SHEETS.users);
  if (users.some(function (u) { return u.name === p.name; })) return { ok: false, error: "이미 존재하는 이름입니다." };
  const u = { userId: genId("U"), name: p.name, passwordHash: hashPw(p.password || "1234"), role: p.role || "user", active: true, email: p.email || "", createdAt: nowIso() };
  appendRow(SHEETS.users, u);
  return { ok: true, data: { userId: u.userId, name: u.name, role: u.role, active: true } };
}
function adminUpdateUser(p) {
  const ri = findRowIndex(SHEETS.users, "userId", p.userId);
  if (ri < 0) return { ok: false, error: "사용자를 찾을 수 없습니다." };
  const patch = p.patch || {};
  Object.keys(patch).forEach(function (k) {
    if (k === "password") updateCell(SHEETS.users, ri, "passwordHash", hashPw(patch[k]));
    else updateCell(SHEETS.users, ri, k, patch[k]);
  });
  return { ok: true, data: { updated: true } };
}
function adminDeleteUser(p) {
  const ri = findRowIndex(SHEETS.users, "userId", p.userId);
  if (ri < 0) return { ok: false, error: "사용자를 찾을 수 없습니다." };
  sheet(SHEETS.users).deleteRow(ri);
  return { ok: true, data: { deleted: true } };
}
function computeStats() {
  const eq = readTable(SHEETS.equipment);
  const logs = readTable(SHEETS.logs);
  const counts = {};
  logs.forEach(function (l) { counts[l.equipmentId] = (counts[l.equipmentId] || 0) + 1; });
  return eq.map(function (e) { return { equipmentId: e.equipmentId, name: e.name, status: e.status, useCount: counts[e.equipmentId] || 0 }; });
}

/* ----------------------------- 출력 ----------------------------- */
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ----------------------------- 초기 세팅 도우미 -----------------------------
 * 시트 편집기에서 한 번 실행하면 4개 탭과 헤더를 자동 생성합니다.
 * (이미 있으면 건너뜀) — 메뉴에서 setupSheets 실행.
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const defs = {
    Equipment: ["equipmentId", "name", "category", "subCategory", "location", "status", "currentReservationId", "manager", "note", "updatedAt"],
    Users: ["userId", "name", "passwordHash", "role", "active", "email", "createdAt"],
    Reservations: ["reservationId", "equipmentId", "userName", "startTime", "endTime", "status", "logSubmitted", "createdAt"],
    UsageLogs: ["logId", "reservationId", "equipmentId", "userName", "actualStart", "actualEnd", "usageDetail", "result", "createdAt"],
  };
  Object.keys(defs).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(defs[name]);
  });
  // 기본 관리자 계정
  var users = readTable("Users");
  if (!users.some(function (u) { return u.role === "admin"; })) {
    appendRow("Users", { userId: genId("U"), name: "관리자", passwordHash: hashPw("0000"), role: "admin", active: true, email: "", createdAt: nowIso() });
  }
}
