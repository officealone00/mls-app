import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "mls-standings", // 콘솔에 등록할 appName
  brand: {
    displayName: "MLS 순위",
    primaryColor: "#001F5F", // MLS 공식 네이비
    icon: "https://static.toss.im/appsintoss/24163/935dd823-9e7b-44d0-9a29-f98dc11df2bd.png", // 콘솔에서 업로드한 아이콘 URL
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite dev",
      build: "vite build",
    },
  },
  webViewProps: {
    navigationBar: {
      withBackButton: false,
    },
  },
  permissions: [],
  outdir: "dist",
});
