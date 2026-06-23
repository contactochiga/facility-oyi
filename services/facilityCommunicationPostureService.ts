import API from "./api";
import { communityService } from "./communityService";
import { messagesService, type ModerationReport, type ThreadLite } from "./messagesService";

export type CommunicationPostureState = "stable" | "attention" | "limited" | "unavailable";
export type CommunicationSupportState = "unavailable";

export type FacilityCommunicationPosture = {
  unreadMessages: number;
  unreadResidentThreads: number;
  moderationPending: number;
  supportState: CommunicationSupportState;
  postureState: CommunicationPostureState;
};

const residentThreadPattern = /resident|homeowner|guest|owner|admin/i;

function lower(value: unknown) {
  return String(value || "").toLowerCase();
}

function isResidentThread(thread: ThreadLite) {
  return (
    !thread.peer?.role ||
    residentThreadPattern.test(String(thread.peer.role || ""))
  );
}

function sumUnreadMessages(threads: ThreadLite[]) {
  return (threads || []).reduce(
    (sum, thread) => sum + Number(thread?.unread_count || 0),
    0
  );
}

function countUnreadResidentThreads(threads: ThreadLite[]) {
  return (threads || []).filter(
    (thread) =>
      isResidentThread(thread) && Number(thread?.unread_count || 0) > 0
  ).length;
}

function countModerationPending(posts: any[], reports: ModerationReport[]) {
  const flagged = (posts || []).filter((post) =>
    /flagged|reported|review/.test(lower(post?.status))
  );
  return flagged.length + (reports || []).length;
}

export async function loadUnreadInboxThreads(): Promise<ThreadLite[]> {
  const res = await API.get("/messages/inbox");
  return Array.isArray(res.data?.threads) ? res.data.threads : [];
}

export async function loadUnreadMessageCount(): Promise<number> {
  return sumUnreadMessages(await loadUnreadInboxThreads());
}

export async function loadFacilityCommunicationPosture(
  estateId: string
): Promise<FacilityCommunicationPosture> {
  const [inboxResult, postsResult, reportsResult] = await Promise.allSettled([
    loadUnreadInboxThreads(),
    communityService.listByEstate(estateId),
    messagesService.listReports("open", 80),
  ]);

  const inboxAvailable = inboxResult.status === "fulfilled";
  const postsAvailable = postsResult.status === "fulfilled";
  const reportsAvailable =
    reportsResult.status === "fulfilled" &&
    Array.isArray(reportsResult.value);

  if (!inboxAvailable || !postsAvailable || !reportsAvailable) {
    return {
      unreadMessages: 0,
      unreadResidentThreads: 0,
      moderationPending: 0,
      supportState: "unavailable",
      postureState: "unavailable",
    };
  }

  const threads = inboxResult.value;
  const posts = postsResult.value;
  const reports = reportsResult.value as ModerationReport[];
  const unreadMessages = sumUnreadMessages(threads);
  const unreadResidentThreads = countUnreadResidentThreads(threads);
  const moderationPending = countModerationPending(posts, reports);

  const postureState: CommunicationPostureState =
    unreadResidentThreads > 0 || moderationPending > 0
      ? "attention"
      : "limited";

  return {
    unreadMessages,
    unreadResidentThreads,
    moderationPending,
    supportState: "unavailable",
    postureState,
  };
}
