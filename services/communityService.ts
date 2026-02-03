// services/communityService.ts
import API from "./api";

export type CommunityPost = {
  id: string;
  estate_id: string;
  user_id: string;

  title: string;
  content?: string | null;

  media?: any | null;
  poll?: any | null;

  status?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
};

function pickError(err: any, fallback: string) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export const communityService = {
  /**
   * ✅ BACKEND: GET /community/posts/estate/:estateId
   */
  async listByEstate(estateId: string): Promise<CommunityPost[]> {
    if (!estateId) return [];
    try {
      const res = await API.get(`/community/posts/estate/${estateId}`);
      return Array.isArray(res.data) ? (res.data as CommunityPost[]) : [];
    } catch {
      return [];
    }
  },

  /**
   * ✅ BACKEND: POST /community/post
   * Body expected: { title, content, media, poll, estateId }
   */
  async create(payload: {
    estateId: string;
    title: string;
    content?: string;
    media?: any;
    poll?: any;
  }): Promise<{ post?: CommunityPost; error?: string }> {
    try {
      const res = await API.post(`/community/post`, {
        estateId: payload.estateId,
        title: payload.title,
        content: payload.content ?? "",
        media: payload.media ?? null,
        poll: payload.poll ?? null,
      });
      return { post: res.data as CommunityPost };
    } catch (err: any) {
      return { error: pickError(err, "Failed to create post") };
    }
  },
};
