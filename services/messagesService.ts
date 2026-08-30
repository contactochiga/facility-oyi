import API from "./api";

function pickError(err: any, fallback: string) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export type ResidentLite = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  home_id?: string | null;
  is_online?: boolean;
  last_seen_at?: string | null;
};

export type ThreadLite = {
  id: string;
  kind: "direct" | "group";
  peer?: ResidentLite | null;
  last_message?: {
    id: string;
    body: string;
    sender_id?: string | null;
    created_at?: string | null;
  } | null;
  unread_count?: number;
  last_message_at?: string | null;
};

export type MessageLite = {
  id: string;
  thread_id: string;
  sender_id?: string | null;
  body: string;
  message_type?: "text" | "image" | "video" | "file" | string;
  metadata?: { media_url?: string | null; caption?: string | null; filename?: string | null } | null;
  created_at?: string | null;
  is_hidden?: boolean;
};

export type ModerationReport = {
  id: string;
  reason?: string | null;
  status?: string | null;
  created_at?: string | null;
  resolved_at?: string | null;
  moderator_id?: string | null;
  action?: string | null;
  note?: string | null;
  thread_id?: string | null;
  message_id?: string | null;
  reporter?: any;
  message?: any;
};

export const messagesService = {
  async listResidents(q = ""): Promise<ResidentLite[]> {
    try {
      const res = await API.get("/messages/residents", { params: q ? { q } : undefined });
      return res.data?.residents ?? [];
    } catch {
      return [];
    }
  },

  async listInbox(): Promise<ThreadLite[]> {
    try {
      const res = await API.get("/messages/inbox");
      return res.data?.threads ?? [];
    } catch {
      return [];
    }
  },

  async openDirect(peer_user_id: string) {
    try {
      const res = await API.post("/messages/thread/direct", { peer_user_id });
      return res.data as { ok?: boolean; thread?: any };
    } catch (err: any) {
      return { error: pickError(err, "Failed to open direct thread") } as any;
    }
  },

  async listMessages(threadId: string): Promise<MessageLite[]> {
    try {
      const res = await API.get(`/messages/thread/${encodeURIComponent(threadId)}/messages`, {
        params: { limit: 100 },
      });
      return res.data?.messages ?? [];
    } catch {
      return [];
    }
  },

  async sendMessage(threadId: string, body: string) {
    try {
      const res = await API.post(`/messages/thread/${encodeURIComponent(threadId)}/messages`, { body });
      return res.data as { ok?: boolean; message?: MessageLite };
    } catch (err: any) {
      return { error: pickError(err, "Failed to send message") } as any;
    }
  },

  async markRead(threadId: string) {
    try {
      const res = await API.post(`/messages/thread/${encodeURIComponent(threadId)}/read`);
      return res.data as { ok?: boolean };
    } catch (err: any) {
      return { error: pickError(err, "Failed to mark thread read") } as any;
    }
  },

  async setArchived(threadId: string, archived: boolean) {
    try {
      const res = await API.post(`/messages/thread/${encodeURIComponent(threadId)}/archive`, { archived });
      return res.data as { ok?: boolean; thread?: { id: string; is_archived: boolean } };
    } catch (err: any) {
      return { error: pickError(err, "Failed to archive this conversation") } as any;
    }
  },

  async uploadMedia(input: { base64: string; mime: string; filename?: string; mediaType?: "image" | "video" | "file" }) {
    try {
      const res = await API.post("/messages/media/upload", input);
      return res.data as { ok?: boolean; url?: string; mime?: string; mediaType?: string };
    } catch (err: any) {
      return { error: pickError(err, "Failed to upload attachment") } as any;
    }
  },

  async sendMedia(threadId: string, media: { url: string; mediaType: "image" | "video" | "file"; caption?: string; filename?: string }) {
    try {
      const res = await API.post(`/messages/thread/${encodeURIComponent(threadId)}/messages`, {
        body: media.caption || "",
        message_type: media.mediaType === "video" ? "video" : media.mediaType,
        metadata: { media_url: media.url, caption: media.caption || "", filename: media.filename || null },
      });
      return res.data as { ok?: boolean; message?: MessageLite };
    } catch (err: any) {
      return { error: pickError(err, "Failed to send attachment") } as any;
    }
  },

  async listReports(status = "open", limit = 40): Promise<ModerationReport[] | { error: string }> {
    try {
      const res = await API.get("/messages/mod/reports", { params: { status, limit } });
      return res.data?.reports ?? [];
    } catch (err: any) {
      return { error: pickError(err, "Failed to load moderation queue") } as any;
    }
  },

  async resolveReport(
    reportId: string,
    payload: { action: "dismiss" | "hide_message" | "mute_sender"; note?: string; mute_hours?: number }
  ) {
    try {
      const res = await API.post(
        `/messages/mod/reports/${encodeURIComponent(reportId)}/resolve`,
        payload
      );
      return res.data as { ok?: boolean; report?: any };
    } catch (err: any) {
      return { error: pickError(err, "Failed moderation action") } as any;
    }
  },
};

export default messagesService;
