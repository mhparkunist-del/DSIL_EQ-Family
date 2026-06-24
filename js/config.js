/* =========================================================================
 * KAIST DSIL 장비 예약 플랫폼 — 설정 파일
 * 이 파일만 오너(관리자)가 수정합니다.
 * =========================================================================
 *
 * [데모 모드]  API_URL 이 비어("") 있으면 → 브라우저(localStorage)에 저장되는
 *             데모 모드로 동작합니다. Google Sheets 없이도 화면이 전부 동작합니다.
 *
 * [라이브 모드] Google Apps Script 웹앱을 배포한 뒤, 받은 /exec URL 을
 *             아래 API_URL 에 붙여넣고, SHARED_SECRET 을 Apps Script의
 *             Script Property 값과 동일하게 맞추면 → 실제 시트에 저장됩니다.
 *             자세한 절차는 SETUP.md 참고.
 */
window.DSIL_CONFIG = {
  // 예: "https://script.google.com/macros/s/AKfycb..../exec"
  API_URL: "",

  // Apps Script Script Property 의 SHARED_SECRET 과 동일하게.
  SHARED_SECRET: "",

  // 관리자 모드 진입용 비밀번호 (화면 가림막 용도 — 실제 보안 아님)
  ADMIN_PASSWORD: "0000",

  // 조직명 (화면 표기)
  ORG_NAME: "KAIST DSIL",
};
