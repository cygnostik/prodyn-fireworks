import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  build: { target: "es2022", sourcemap: false, chunkSizeWarningLimit: 700 },
  plugins: [
    {
      name: "deployment-metadata",
      transformIndexHtml(html) {
        const site = process.env.SITE_URL;
        if (!site) return html;
        const url = new URL(site);
        if (
          url.protocol !== "https:" &&
          !(
            url.protocol === "http:" &&
            ["localhost", "127.0.0.1"].includes(url.hostname)
          )
        )
          throw new Error("SITE_URL must use HTTPS");
        if (url.search || url.hash || url.username || url.password)
          throw new Error(
            "SITE_URL must be a site directory without credentials, query or fragment",
          );
        if (!url.pathname.endsWith("/")) url.pathname += "/";
        const root = url.href;
        const safe = root
          .replaceAll("&", "&amp;")
          .replaceAll('"', "&quot;")
          .replaceAll("<", "&lt;");
        return html
          .replace(
            "<!-- DEPLOYMENT_METADATA -->",
            `<link rel="canonical" href="${safe}"><meta property="og:url" content="${safe}">`,
          )
          .replaceAll(
            'content="./assets/social.jpg"',
            `content="${new URL("assets/social.jpg", url).href.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")}"`,
          );
      },
    },
  ],
});
