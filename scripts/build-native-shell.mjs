import { mkdir, writeFile } from "node:fs/promises";

const url = process.env.CAP_SERVER_URL?.trim();
if (!url) {
  console.error("CAP_SERVER_URL is required for a native Facility build. Use the HTTPS deployed Facility URL.");
  process.exit(1);
}

await mkdir("native-shell", { recursive: true });
await writeFile("native-shell/index.html", `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Oyi Facility</title></head><body><script>location.replace(${JSON.stringify(url)});</script></body></html>`);
