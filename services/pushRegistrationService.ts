import API from "./api";

const TOKEN_KEY = "oyi_facility_push_token";
let started = false;

function storedToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function saveToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

async function registerToken(payload: Record<string, any>) {
  await API.post("/push/register", payload);
}

async function unregisterToken(token: string) {
  await API.post("/push/unregister", { token });
}

export async function ensureFacilityPushRegistration() {
  if (typeof window === "undefined" || started) return { supported: false, reason: "already_started" as const };
  const [{ Capacitor }, pushModule, deviceModule] = await Promise.all([
    import("@capacitor/core"),
    import("@capacitor/push-notifications"),
    import("@capacitor/device"),
  ]);

  if (!Capacitor.isNativePlatform()) {
    return { supported: false, reason: "web" as const };
  }

  const { PushNotifications } = pushModule;
  const { Device } = deviceModule;
  started = true;

  try {
    const permissionState = await PushNotifications.checkPermissions();
    const permission = permissionState.receive === "prompt" ? await PushNotifications.requestPermissions() : permissionState;
    if (permission.receive !== "granted") {
      return { supported: false, reason: "denied" as const };
    }

    PushNotifications.removeAllListeners();
    PushNotifications.addListener("registration", async ({ value }) => {
      const info = await Device.getInfo().catch(() => null);
      const identifier = await Device.getId().catch(() => null);
      saveToken(value);
      await registerToken({
        token: value,
        platform: Capacitor.getPlatform(),
        provider: Capacitor.getPlatform() === "ios" ? "apns" : "fcm",
        environment: process.env.NODE_ENV === "production" ? "production" : "development",
        app_bundle: "com.ochiga.oyifacility",
        app_version: null,
        device_id: identifier?.identifier || null,
        device_model: info?.model || null,
      }).catch(() => null);
    });
    PushNotifications.addListener("registrationError", () => undefined);
    PushNotifications.addListener("pushNotificationReceived", () => undefined);
    PushNotifications.addListener("pushNotificationActionPerformed", () => undefined);
    await PushNotifications.register();
    return { supported: true, reason: "registered" as const };
  } catch {
    started = false;
    return { supported: false, reason: "failed" as const };
  }
}

export async function cleanupFacilityPushRegistration() {
  const token = storedToken();
  started = false;
  if (!token) return;
  await unregisterToken(token).catch(() => null);
  clearToken();
}

export async function readFacilityPushReadiness() {
  try {
    const res = await API.get("/push/readiness");
    return res.data;
  } catch {
    return null;
  }
}
