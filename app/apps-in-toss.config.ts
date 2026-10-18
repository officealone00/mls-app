import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  // 콘솔에 등록한 appName (공유 링크 intoss://mls-standings)
  appName: "mls-standings",

  brand: {
    // MLS 공식 네이비
    primaryColor: "#001F5F"
  },

  // (2026-10-18) 토스 내비게이션 바 뒤로가기 버튼을 다시 켠다 — 자체 뒤로가기 버튼은 제거했으므로 필수
  navigationBar: {
    withBackButton: true,
  },

  permissions: [],
  webBundleDir: "dist"
});
