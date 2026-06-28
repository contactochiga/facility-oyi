"use client";

import { io, type Socket } from "socket.io-client";
import { ensureRuntimeSubscriptions } from "@/lib/runtimeSubscriptions";
import { useFacilityRealtimeStore } from "@/store/useFacilityRealtimeStore";
import { normalizeSignal } from "@/lib/operationalSignal";
import { evaluateOyiCoreRuntime } from "@/services/oyiCoreRuntimeService";
import { signalInputFromRealtimePayload } from "@/services/signalAwarenessService";

let socket: Socket | null = null;
let activeToken = "";

const EVENTS = [
  "device.registry.updated",
  "device.status.updated",
  "device.discovered",
  "edge.heartbeat",
  "visitor.updated",
  "visitor.created",
  "maintenance.updated",
  "security.alert",
  "camera.event",
  "camera.status.updated",
  "incident.created",
  "incident.updated",
  "twin.state.updated",
  "utility.telemetry.updated",
  "community.updated",
  "notification",
  "notification:new",
  "office.notification",
  "audit.recorded",
];

function apiBase() {
  return (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
}

async function emitLocal(event: string, payload: Record<string, any>) {
  const runtime = ensureRuntimeSubscriptions();
  const serverSignal = payload?.operational_signal as Record<string, any> | undefined;
  const serverAwareness = payload?.operational_awareness;
  const serverInsights = Array.isArray(payload?.operational_insights) ? payload.operational_insights : [];
  const serverRecommendations = Array.isArray(payload?.operational_recommendations) ? payload.operational_recommendations : [];
  const serverAutomationPlans = Array.isArray(payload?.operational_automation_plans) ? payload.operational_automation_plans : [];
  const signal = normalizeSignal(serverSignal || signalInputFromRealtimePayload(event, payload || {}));
  const receipt = {
    accepted: true,
    signal,
    priority: payload?.receipt?.priority || payload?.signal_priority || "normal",
    duplicate: Boolean(payload?.receipt?.duplicate),
    outputs: Array.isArray(payload?.receipt?.outputs) ? payload.receipt.outputs : [],
    issues: Array.isArray(payload?.receipt?.issues) ? payload.receipt.issues : [],
    receivedAt: payload?.receipt?.receivedAt || new Date().toISOString(),
    auditId: payload?.receipt?.auditId || `${event}:${signal.id || Date.now()}`,
  };
  if (!receipt.accepted) return;
  const signalPayload = { ...payload, operational_signal: receipt.signal, signal_priority: receipt.priority };
  useFacilityRealtimeStore.getState().pushEvent(event, signalPayload);
  let awareness = serverAwareness;
  let insights = serverInsights;
  let recommendations = serverRecommendations;
  let automationPlans = serverAutomationPlans;

  if (!awareness || !insights.length || !recommendations.length || !automationPlans.length) {
    try {
      const bundle = await evaluateOyiCoreRuntime([receipt.signal]);
      awareness = awareness || bundle.awareness[0] || null;
      insights = insights.length ? insights : bundle.insights;
      recommendations = recommendations.length ? recommendations : bundle.recommendations;
      automationPlans = automationPlans.length ? automationPlans : bundle.automationPlans;
    } catch {
      awareness = awareness || null;
    }
  }

  if (!awareness) return;
  const detail = { event, payload: signalPayload, signal: receipt.signal, awareness, insights, recommendations, automationPlans, receipt, source: "facility_realtime" };
  runtime.publishSignal(detail);
  runtime.publishAwareness(detail);
  runtime.publishInsights(detail);
  runtime.publishRecommendations(detail);
  runtime.publishAutomation(detail);
}

export function connectFacilityRealtime(input: { token: string; estateId?: string | null; userId?: string | null }) {
  if (typeof window === "undefined") return null;
  const base = apiBase();
  if (!base || !input.token) {
    useFacilityRealtimeStore.getState().setStatus("offline");
    return null;
  }
  if (socket?.connected && activeToken === input.token) return socket;

  disconnectFacilityRealtime();
  activeToken = input.token;
  useFacilityRealtimeStore.getState().setStatus("connecting");

  socket = io(base, {
    transports: ["websocket", "polling"],
    auth: { token: input.token },
    extraHeaders: { "X-Ochiga-Surface": "facility" },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on("connect", () => {
    useFacilityRealtimeStore.getState().connected();
    if (input.estateId) socket?.emit("subscribe:estate", input.estateId);
    if (input.userId) socket?.emit("subscribe:user", input.userId);
  });
  socket.io.on("reconnect_attempt", () => useFacilityRealtimeStore.getState().setStatus("reconnecting"));
  socket.on("disconnect", () => useFacilityRealtimeStore.getState().setStatus("offline"));
  socket.on("connect_error", () => useFacilityRealtimeStore.getState().setStatus("offline"));
  socket.on("signal", (payload: Record<string, any>) => {
    void emitLocal(String(payload?.type || "signal"), payload || {});
  });
  socket.on("error:permission", (payload: Record<string, any>) => {
    void emitLocal("permission.denied", payload || {});
  });

  for (const event of EVENTS) {
    socket.on(event, (payload: Record<string, any>) => {
      void emitLocal(event, payload || {});
    });
  }

  return socket;
}

export function disconnectFacilityRealtime() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  socket = null;
  activeToken = "";
  useFacilityRealtimeStore.getState().reset();
}
