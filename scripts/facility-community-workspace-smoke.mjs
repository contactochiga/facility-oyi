import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page=readFileSync(new URL("../app/(protected)/community/page.tsx",import.meta.url),"utf8");
const service=readFileSync(new URL("../services/communityService.ts",import.meta.url),"utf8");
for(const label of ["Overview","Posts","Members","Groups","Announcements","Events","Reports","Settings"])assert.match(page,new RegExp(`\\[\\"${label.toLowerCase()}\\",\\"${label}`));
for(const label of ["Total members","Active members","Posts this month","Engagement","Reports","Pending moderation","Community Overview","Top Engagement","Recent Posts","Community Announcements","Community Health"])assert.match(page,new RegExp(label,"i"));
assert.match(page,/communityService\.listByEstate/);assert.match(page,/facilityService\.listEstateUsers/);assert.match(page,/messagesService\.listReports/);assert.match(page,/communityService\.createPost/);assert.match(page,/communityService\.uploadMedia/);assert.match(page,/communityService\.listComments/);assert.match(page,/communityService\.trackView/);assert.match(page,/facility:realtime-event/);
assert.match(service,/\/community\/posts\/estate\//);assert.match(service,/\/community\/media\/upload/);assert.doesNotMatch(page,/1,286|843 active|248 posts|64%|78%/);assert.match(page,/no undocumented weighting/i);assert.match(page,/no canonical contract exists/i);
console.log("Facility Community workspace smoke passed.");
