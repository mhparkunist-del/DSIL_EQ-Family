// 모바일 메뉴 토글
const navToggle = document.getElementById("navToggle");
const nav = document.getElementById("nav");

navToggle.addEventListener("click", () => {
  nav.classList.toggle("open");
});

// 메뉴 클릭 시 모바일 메뉴 닫기
nav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => nav.classList.remove("open"));
});

// 문의 폼 (예시 동작 — 실제 전송 없음)
const form = document.getElementById("contactForm");
const formMsg = document.getElementById("formMsg");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  formMsg.textContent = "문의가 접수되었습니다. 감사합니다! ✅";
  form.reset();
});
