import assert from "node:assert/strict";
import fs from "node:fs";

const service = fs.readFileSync("services/cameraService.ts", "utf8");
const player = fs.readFileSync("components/cameras/CameraPlayer.tsx", "utf8");
const page = fs.readFileSync("app/(protected)/cameras/page.tsx", "utf8");
const runtime = fs.readFileSync("lib/oyi-camera-core/runtime.ts", "utf8");
assert.match(runtime, /DO NOT EDIT FRONTEND COPIES DIRECTLY/);
assert.match(service, /createCameraReadClient/);
assert.match(service, /\/edge\/camera-discovery\/commands/);
assert.match(service, /\/provision/);
assert.doesNotMatch(service, /\/cameras\/scan|new Hls|RTCPeerConnection/);
assert.doesNotMatch(player, /new Hls|import\("hls\.js"\)|rewindSeconds/);
assert.doesNotMatch(page, /metadata\?\.raw\?\.rtsp|rtsp_url|cameraService\.bind/);
console.log("Facility camera canonicalization guard passed");
