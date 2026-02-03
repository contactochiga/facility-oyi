// src/services/communityService.ts
import API from "./api";

export type CommunityPost = {
  id: string;
  estate_id: string;
  user_id: string;
  title: string;
  content?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  media?: any;
  poll?: any;
};

export const communityService = {
  async listByEstate(estateId: string): Promise<CommunityPost[]> {
    const res = await API.get(`/community/posts/estate/${estateId}`);
    // backend returns array
    return res.data || [];
  },

  async createPost(input: {
    estateId: string;
    title: string;
    content?: string | null;
    media?: any;
    poll?: any;
  }): Promise<CommunityPost> {
    const res = await API.post(`/community/post`, {
      estateId: input.estateId,
      title: input.title,
      content: input.content ?? null,
      media: input.media ?? null,
      poll: input.poll ?? null,
    });

    return res.data as CommunityPost;
  },
};
