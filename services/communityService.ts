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
  body?: string | null;
  author_name?: string | null;
  created_by_name?: string | null;
  created_by_email?: string | null;
};

export type UploadedCommunityMedia = {
  ok?: boolean;
  url: string;
  mime?: string;
  mediaType?: "image" | "video";
  key?: string;
};

export const communityService = {
  async listByEstate(estateId: string): Promise<CommunityPost[]> {
    const res = await API.get(`/community/posts/estate/${estateId}`);
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map((row: any) => ({
      ...row,
      content: row?.content ?? row?.body ?? null,
    })) as CommunityPost[];
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

    const row = res.data || {};
    return {
      ...row,
      content: row?.content ?? row?.body ?? null,
    } as CommunityPost;
  },

  async updatePost(
    postId: string,
    input: { title?: string | null; content?: string | null; status?: string | null }
  ): Promise<CommunityPost> {
    const res = await API.put(`/community/post/${postId}`, {
      title: input.title,
      content: input.content,
      status: input.status,
    });
    const row = res.data || {};
    return {
      ...row,
      content: row?.content ?? row?.body ?? null,
    } as CommunityPost;
  },

  async deletePost(postId: string): Promise<{ ok?: boolean }> {
    const res = await API.delete(`/community/post/${postId}`);
    return res.data as { ok?: boolean };
  },

  async uploadMedia(input: {
    base64: string;
    mime: string;
    filename?: string;
    mediaType?: "image" | "video";
  }): Promise<UploadedCommunityMedia> {
    const res = await API.post("/community/media/upload", input);
    return res.data as UploadedCommunityMedia;
  },
};
