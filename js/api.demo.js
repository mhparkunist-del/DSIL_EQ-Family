/* =========================================================================
 * 데모 API — localStorage 기반. Google Sheets 없이 전체 흐름을 시연.
 * 같은 브라우저에서만 데이터가 공유됩니다. (실제 운영은 라이브 모드)
 * 모든 메서드는 {ok, data?, error?} 형태의 Promise 를 반환합니다.
 * ========================================================================= */
(function () {
  const KEY = "dsil_demo_db_v1";

  function seed() {
    const now = Date.now();
    return {
      equipment: [
        eq("EQ001", "전계방출 주사전자현미경(FE-SEM)", "현미경", "SEM", "1동 101호", "available", "김연구"),
        eq("EQ002", "X-선 회절분석기(XRD)", "분석기", "XRD", "1동 102호", "available", "박교수"),
        eq("EQ003", "원자력간현미경(AFM)", "현미경", "AFM", "2동 201호", "available", "이박사"),
        eq("EQ004", "열중량분석기(TGA)", "분석기", "TGA", "2동 203호", "maintenance", "최연구"),
        eq("EQ005", "스퍼터 증착장비", "증착", "Sputter", "3동 B1", "available", "정연구"),
      ],
      users: [
        usr("U001", "관리자", "0000", "admin"),
        usr("U002", "홍길동", "1234", "user"),
        usr("U003", "김철수", "1234", "user"),
      ],
      reservations: [],
      logs: [],
      seq: 1000,
      _t: now,
    };
    function eq(id, name, category, sub, loc, status, mgr) {
      return { equipmentId: id, name, category, subCategory: sub, location: loc, status, currentReservationId: "", manager: mgr, note: "", updatedAt: new Date().toISOString() };
    }
    function usr(id, name, pw, role) {
      return { userId: id, name, password: pw, role, active: true, email: "", createdAt: new Date().toISOString() };
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        const s = seed();
        localStorage.setItem(KEY, JSON.stringify(s));
        return s;
      }
      return JSON.parse(raw);
    } catch (e) {
      const s = seed();
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
  }
  function save(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }
  function nextId(db, prefix) {
    db.seq += 1;
    return prefix + db.seq;
  }
  const ok = (data) => Promise.resolve({ ok: true, data });
  const err = (msg) => Promise.resolve({ ok: false, error: msg });

  /** 사용자 인증 (없으면 자동 생성 — 데모 편의) */
  function auth(db, name, password) {
    name = (name || "").trim();
    if (!name) return { error: "이름을 입력하세요." };
    if (!password) return { error: "비밀번호를 입력하세요." };
    let u = db.users.find((x) => x.name === name);
    if (!u) {
      u = { userId: nextId(db, "U"), name, password, role: "user", active: true, email: "", createdAt: new Date().toISOString() };
      db.users.push(u);
    } else {
      if (u.password !== password) return { error: "비밀번호가 일치하지 않습니다." };
      if (!u.active) return { error: "비활성화된 계정입니다. 관리자에게 문의하세요." };
    }
    return { user: u };
  }

  const api = {
    isDemo: true,

    listEquipment() {
      return ok(load().equipment);
    },
    listReservations() {
      const db = load();
      return ok([...db.reservations].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
    },
    listUsageLogs() {
      return ok(load().logs);
    },
    listUsers() {
      return ok(load().users.map(({ password, ...u }) => u));
    },

    createReservation({ equipmentId, userName, password, startTime, endTime }) {
      const db = load();
      const a = auth(db, userName, password);
      if (a.error) return err(a.error);
      const e = db.equipment.find((x) => x.equipmentId === equipmentId);
      if (!e) return err("장비를 찾을 수 없습니다.");
      if (e.status === "maintenance") return err("점검중인 장비입니다.");
      if (e.status !== "available")
        return err("사용할 수 없는 장비입니다. (이전 사용자의 실적 입력이 필요합니다)");
      if (!startTime || !endTime) return err("예약 시간을 입력하세요.");
      if (new Date(endTime) <= new Date(startTime)) return err("종료 시간이 시작 시간보다 빨라요.");

      const r = {
        reservationId: nextId(db, "R"),
        equipmentId,
        userName: a.user.name,
        startTime,
        endTime,
        status: "in_use",
        logSubmitted: false,
        createdAt: new Date().toISOString(),
      };
      db.reservations.push(r);
      e.status = "in_use";
      e.currentReservationId = r.reservationId;
      e.updatedAt = new Date().toISOString();
      save(db);
      return ok(r);
    },

    submitUsageLog({ reservationId, userName, password, usageDetail, result, actualStart, actualEnd }) {
      const db = load();
      const a = auth(db, userName, password);
      if (a.error) return err(a.error);
      const r = db.reservations.find((x) => x.reservationId === reservationId);
      if (!r) return err("예약을 찾을 수 없습니다.");
      if (r.userName !== a.user.name) return err("본인의 예약만 실적 입력이 가능합니다.");
      if (r.logSubmitted) return err("이미 실적이 입력된 예약입니다.");
      if (!usageDetail) return err("공정/사용 내용을 입력하세요.");

      const log = {
        logId: nextId(db, "L"),
        reservationId,
        equipmentId: r.equipmentId,
        userName: a.user.name,
        actualStart: actualStart || r.startTime,
        actualEnd: actualEnd || r.endTime,
        usageDetail,
        result: result || "",
        createdAt: new Date().toISOString(),
      };
      db.logs.push(log);
      r.status = "completed";
      r.logSubmitted = true;
      const e = db.equipment.find((x) => x.equipmentId === r.equipmentId);
      if (e) {
        e.status = "available";
        e.currentReservationId = "";
        e.updatedAt = new Date().toISOString();
      }
      save(db);
      return ok(log);
    },

    cancelReservation({ reservationId, userName, password }) {
      const db = load();
      const a = auth(db, userName, password);
      if (a.error) return err(a.error);
      const r = db.reservations.find((x) => x.reservationId === reservationId);
      if (!r) return err("예약을 찾을 수 없습니다.");
      if (r.userName !== a.user.name) return err("본인의 예약만 취소할 수 있습니다.");
      if (r.logSubmitted) return err("이미 완료된 예약은 취소할 수 없습니다.");
      r.status = "cancelled";
      const e = db.equipment.find((x) => x.equipmentId === r.equipmentId);
      if (e && e.currentReservationId === r.reservationId) {
        e.status = "available";
        e.currentReservationId = "";
      }
      save(db);
      return ok(r);
    },

    /* ---------------- 관리자 ---------------- */
    adminAddEquipment(p) {
      const db = load();
      if (!p.name) return err("장비명을 입력하세요.");
      const e = {
        equipmentId: nextId(db, "EQ"),
        name: p.name,
        category: p.category || "",
        subCategory: p.subCategory || "",
        location: p.location || "",
        status: "available",
        currentReservationId: "",
        manager: p.manager || "",
        note: p.note || "",
        updatedAt: new Date().toISOString(),
      };
      db.equipment.push(e);
      save(db);
      return ok(e);
    },
    adminForceUnlock({ equipmentId }) {
      const db = load();
      const e = db.equipment.find((x) => x.equipmentId === equipmentId);
      if (!e) return err("장비를 찾을 수 없습니다.");
      // 잠금 걸려있던 예약을 강제 종료 처리
      const r = db.reservations.find((x) => x.reservationId === e.currentReservationId);
      if (r && !r.logSubmitted) {
        r.status = "cancelled";
      }
      e.status = "available";
      e.currentReservationId = "";
      e.updatedAt = new Date().toISOString();
      save(db);
      return ok(e);
    },
    adminSetMaintenance({ equipmentId, on }) {
      const db = load();
      const e = db.equipment.find((x) => x.equipmentId === equipmentId);
      if (!e) return err("장비를 찾을 수 없습니다.");
      if (on && e.status === "in_use") return err("사용중인 장비는 점검 전환할 수 없습니다.");
      e.status = on ? "maintenance" : "available";
      save(db);
      return ok(e);
    },
    adminAddUser(p) {
      const db = load();
      if (!p.name) return err("이름을 입력하세요.");
      if (db.users.some((u) => u.name === p.name)) return err("이미 존재하는 이름입니다.");
      const u = { userId: nextId(db, "U"), name: p.name, password: p.password || "1234", role: p.role || "user", active: true, email: p.email || "", createdAt: new Date().toISOString() };
      db.users.push(u);
      save(db);
      return ok({ ...u, password: undefined });
    },
    adminUpdateUser({ userId, patch }) {
      const db = load();
      const u = db.users.find((x) => x.userId === userId);
      if (!u) return err("사용자를 찾을 수 없습니다.");
      Object.assign(u, patch);
      save(db);
      return ok({ ...u, password: undefined });
    },
    adminDeleteUser({ userId }) {
      const db = load();
      const i = db.users.findIndex((x) => x.userId === userId);
      if (i < 0) return err("사용자를 찾을 수 없습니다.");
      db.users.splice(i, 1);
      save(db);
      return ok(true);
    },
    adminStats() {
      const db = load();
      const counts = {};
      db.logs.forEach((l) => (counts[l.equipmentId] = (counts[l.equipmentId] || 0) + 1));
      const rows = db.equipment.map((e) => ({
        equipmentId: e.equipmentId,
        name: e.name,
        status: e.status,
        useCount: counts[e.equipmentId] || 0,
      }));
      return ok(rows);
    },

    /** 데모 데이터 초기화 */
    resetDemo() {
      localStorage.removeItem(KEY);
      return ok(true);
    },
  };

  window.apiDemo = api;
})();
