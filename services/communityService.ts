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
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
  views?: number;
  view_count?: number;
  category?: string | null;
  is_pinned?: boolean | null;
  pinned_until?: string | null;
  audience_type?: string | null;
  audience_ref?: string | null;
  scheduled_at?: string | null;
  priority?: string | null;
  author_avatar_url?: string | null;
  author_role?: string | null;
  source_type?: string | null;
  source_label?: string | null;
  is_official?: boolean;
};

export type CommunityComment = {
  id: string;
  post_id: string;
  content: string;
  user_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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
    const rows = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.posts) ? res.data.posts : Array.isArray(res.data?.items) ? res.data.items : [];
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
    category?: string | null;
    status?: string | null;
    is_pinned?: boolean | null;
    pinned_until?: string | null;
    audience?: { type?: string | null; ref?: string | null } | null;
    scheduled_at?: string | null;
    priority?: string | null;
  }): Promise<CommunityPost> {
    const res = await API.post(`/community/post`, {
      estateId: input.estateId,
      title: input.title,
      content: input.content ?? null,
      media: input.media ?? null,
      poll: input.poll ?? null,
      category: input.category ?? "notice",
      status: input.status ?? "active",
      is_pinned: input.is_pinned ?? false,
      pinned_until: input.pinned_until ?? null,
      audience: input.audience ?? null,
      scheduled_at: input.scheduled_at ?? null,
      priority: input.priority ?? null,
    });

    const row = res.data || {};
    return {
      ...row,
      content: row?.content ?? row?.body ?? null,
    } as CommunityPost;
  },

  async updatePost(
    postId: string,
    input: { title?: string | null; content?: string | null; media?: any; status?: string | null; category?: string | null; is_pinned?: boolean | null; pinned_until?: string | null; audience?: { type?: string | null; ref?: string | null } | null; scheduled_at?: string | null; priority?: string | null }
  ): Promise<CommunityPost> {
    const res = await API.put(`/community/post/${postId}`, {
      title: input.title,
      content: input.content,
      media: input.media,
      status: input.status,
      category: input.category,
      is_pinned: input.is_pinned,
      pinned_until: input.pinned_until,
      audience: input.audience,
      scheduled_at: input.scheduled_at,
      priority: input.priority,
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

  async listComments(postId: string): Promise<CommunityComment[]> {
    const res = await API.get(`/community/post/${postId}/comments`);
    return Array.isArray(res.data) ? (res.data as CommunityComment[]) : [];
  },

  async createComment(postId: string, content: string): Promise<CommunityComment> {
    const res = await API.post(`/community/post/${postId}/comment`, { content });
    return res.data as CommunityComment;
  },

  async reactToPost(postId: string, type = "like"): Promise<any> {
    const res = await API.post(`/community/post/${postId}/react`, { type });
    return res.data as any;
  },

  async trackView(postId: string): Promise<any> {
    const res = await API.post(`/community/post/${postId}/view`);
    return res.data as any;
  },

  async reportPost(postId: string, reason: string): Promise<any> {
    const res = await API.post(`/community/post/${postId}/report`, { reason });
    return res.data as any;
  },
};
