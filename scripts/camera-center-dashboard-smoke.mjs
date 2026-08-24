import fs from "node:fs";

const page = fs.readFileSync("app/(protected)/cameras/page.tsx", "utf8");
const dashboard = fs.readFileSync("components/cameras/CameraCenterDashboard.tsx", "utf8");
const service = fs.readFileSync("services/cameraService.ts", "utf8");

const checks = [
  [page.includes("CameraCenterDashboard"), "Camera Center page uses the dashboard composition"],
  [dashboard.includes("Live Camera Wall") && dashboard.includes("Recent Camera Events"), "camera wall and event rail exist"],
  [dashboard.includes("Camera Health Trend") && dashboard.includes("Cameras Requiring Attention"), "health panels exist"],
  [dashboard.includes("Camera Inventory") && dashboard.includes("Active Edge Nodes") && dashboard.includes("Storage & Media"), "inventory, Edge and media panels exist"],
  [dashboard.includes("No cameras connected yet") && dashboard.includes("No Oyi Edge connected"), "production zero states exist"],
  [dashboard.includes("onOpenCamera") && !dashboard.includes("<CameraPlayer"), "wall is lazy and does not auto-open streams"],
  [service.includes("createCameraMediaReadClient") && service.includes("createMediaAccess"), "authorized Camera Media client is used"],
  [!page.includes("/cameras/scan") && !dashboard.includes("/cameras/scan"), "deleted cloud camera scan route is absent"],
  [!dashboard.includes("rtsp://") && !dashboard.includes("edge_hls_url") && !dashboard.includes("storage_key"), "private runtime and storage details are absent"],
  [!dashboard.includes('"-1m"') && !dashboard.includes('"-5m"') && !dashboard.includes('"-15m"'), "fake rewind is absent"],
  [dashboard.includes("sm:grid-cols-2") && dashboard.includes("xl:grid-cols-4"), "responsive wall structure exists"],
];

for (const [ok, message] of checks) {
  if (!ok) throw new Error(`Camera Center regression: ${message}`);
  console.log(`✓ ${message}`);
}
