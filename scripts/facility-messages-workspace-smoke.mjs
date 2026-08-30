#!/usr/bin/env node
// OYI Facility -- Final Messages + Buildings/Home Registry consolidation
// pass. Static regression proof that Messages is built entirely from the
// real, already-shipped dm_threads/dm_messages system -- no fabricated
// conversations, no fake calling, no duplicate announcements backend.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/(protected)/messages/page.tsx", import.meta.url), "utf8");
const service = await readFile(new URL("../services/messagesService.ts", import.meta.url), "utf8");
const realtime = await readFile(new URL("../services/facilityRealtime.ts", import.meta.url), "utf8");

// Header per the exact required copy.
assert.match(page, /title="Messages" subtitle="Communication across your facility\."/);
assert.match(page, />New Message</);
assert.match(page, />Announcements</);

// KPI strip -- every value must trace to a real source, not a literal.
assert.match(page, /totalUnread/);
assert.match(page, /threads\.reduce\(\(sum, t\) => sum \+ Number\(t\.unread_count \|\| 0\)/);
assert.match(page, /value={loading \? "—" : threads\.length}/);
assert.match(page, /value={loading \? "—" : residentPeople\.length}/);
assert.match(page, /value={loading \? "—" : facilityPeople\.filter\(\(p\) => p\.is_online\)\.length}/);
assert.match(page, /value={loading \? "—" : reports\.length}/);
assert.doesNotMatch(page, /value=\{?["']?\d+["']?\}?\s*label=/i);

// Real data sources only -- inbox, residents, moderation reports,
// canonical estate structure (for home context), real maintenance, real
// community/announcements. No mock arrays.
for (const call of ["messagesService.listInbox", "messagesService.listResidents", "messagesService.listMessages", "messagesService.sendMessage", "messagesService.markRead", "messagesService.setArchived", "facilityService.estateStructure", "maintenanceService.list", "communityService.listByEstate"]) {
  assert.match(page, new RegExp(call.replace(".", "\\.")));
}
assert.doesNotMatch(page, /John Doe|Jane Smith|Estate Manager|Water Utility|Security Desk|Maintenance Team/);

// No group/team channel creation was fabricated -- only real 1:1 direct
// threads, via the one real thread-creation contract.
assert.match(page, /messagesService\.openDirect/);
assert.doesNotMatch(page, /kind:\s*"group"|createGroupThread|createChannel/);

// Telephony: audited and found to have no callable route at all (not
// just missing credentials) -- the control stays visible but is
// permanently disabled with an honest reason, never wired to a fake
// success path.
assert.match(page, /<Phone /);
assert.match(page, /disabled title="Voice calling isn't available yet/);
assert.doesNotMatch(page, /communicationRuntime|TwilioVoiceAdapter|\/calls["'`]|placeCall\(/);

// Conversation assignment has no backing field on dm_threads and must
// not be simulated as a synthetic system-event line in the timeline --
// the timeline only ever renders real dm_messages rows.
assert.doesNotMatch(page, /system_event|syntheticEvent|fakeSystemMessage/i);

// Three-dot menu only exposes actions with a real, wired capability
// behind them (archive -- new self-service endpoint; report -- existing
// moderation endpoint; view home -- real navigation).
assert.match(page, /toggleArchive/);
assert.match(page, /setReportTarget/);

// Announcements route through the real Community capability -- no
// second announcements backend, no invented group messaging.
assert.match(page, /communityService\.createPost/);
assert.match(page, /category: "announcement"/);
assert.doesNotMatch(page, /\/messages\/announcements|announcementsService\.(create|post)/);

// Realtime reuses the existing dm:new Socket.IO event (already emitted
// server-side) instead of a manual Refresh button or a duplicate
// polling loop.
assert.match(page, /facility:dm-message/);
assert.doesNotMatch(page, /setInterval\(.*load|>Refresh</);
assert.match(realtime, /socket\.on\("dm:new"/);
assert.match(realtime, /facility:dm-message/);

// Attachments use the real S3-backed upload contract, not a fake/local
// object URL pretending to be sent.
assert.match(page, /messagesService\.uploadMedia/);
assert.match(page, /messagesService\.sendMedia/);
assert.match(service, /\/messages\/media\/upload/);

// Archive is a real, newly-wired self-service endpoint on the existing
// (previously unused) is_archived column -- not a client-only toggle.
assert.match(service, /\/messages\/thread\/\$\{encodeURIComponent\(threadId\)\}\/archive/);

console.log("Facility Messages workspace smoke passed.");
