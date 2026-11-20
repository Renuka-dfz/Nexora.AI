import { apiClient } from './client';
import { ContentItem, ContentListResponse, Platform } from '../../types';

export interface GenerateContentPayload {
  topic: string;
  platform?: Platform;
  content_type?: string;
  tone?: string;
  instructions?: string;
  multi_stage?: boolean;
}

export const marketingApi = {
  listContent: async (
    companyId: string,
    params?: { status?: string; platform?: string; limit?: number; offset?: number }
  ): Promise<ContentListResponse> => {
    const query = new URLSearchParams({ company_id: companyId });
    if (params?.status) query.set('status', params.status);
    if (params?.platform) query.set('platform', params.platform);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    return apiClient<ContentListResponse>(`/marketing/content?${query.toString()}`);
  },

  getContent: async (contentId: string): Promise<ContentItem> => {
    return apiClient<ContentItem>(`/marketing/content/${contentId}`);
  },

  generateContent: async (payload: GenerateContentPayload, options: RequestInit = {}): Promise<ContentItem> => {
    return apiClient<ContentItem>('/marketing/content/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
      ...options,
    });
  },

  createContent: async (data: {
    company_id: string;
    content_title: string;
    content_type: string;
    platform_target: Platform;
    content_text: string;
    topic?: string;
    tone?: string;
    generation_type: 'ai' | 'manual';
  }): Promise<ContentItem> => {
    return apiClient<ContentItem>('/marketing/content', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateContent: async (
    contentId: string,
    updates: { content_title?: string; content_text?: string; topic?: string; tone?: string }
  ): Promise<ContentItem> => {
    return apiClient<ContentItem>(`/marketing/content/${contentId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  submitContent: async (contentId: string): Promise<ContentItem> => {
    return apiClient<ContentItem>(`/marketing/content/${contentId}/submit`, {
      method: 'POST',
    });
  },

  approveContent: async (contentId: string): Promise<ContentItem> => {
    return apiClient<ContentItem>(`/marketing/content/${contentId}/approve`, {
      method: 'POST',
    });
  },

  rejectContent: async (contentId: string, feedback: string): Promise<ContentItem> => {
    return apiClient<ContentItem>(`/marketing/content/${contentId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    });
  },

  deleteContent: async (contentId: string): Promise<void> => {
    return apiClient<void>(`/marketing/content/${contentId}`, {
      method: 'DELETE',
    });
  },

  getInstagramStatus: async (): Promise<{
    connected: boolean;
    user_id?: string;
    has_token: boolean;
    account_username?: string;
    account_name?: string;
    message: string;
  }> => {
    return apiClient('/integrations/instagram/status');
  },

  publishToInstagram: async (
    contentId: string,
    payload?: { image_url?: string; image_b64?: string; caption?: string } | string
  ): Promise<{ success: boolean; media_id: string; message: string }> => {
    const bodyObj = typeof payload === 'string' ? { image_url: payload } : (payload || {});
    return apiClient(`/integrations/instagram/publish/${contentId}`, {
      method: 'POST',
      body: JSON.stringify(bodyObj),
    });
  },

  getLinkedInStatus: async (): Promise<{
    connected: boolean;
    author_urn?: string;
    account_name?: string;
    has_token: boolean;
    message: string;
  }> => {
    return apiClient('/integrations/linkedin/status');
  },

  publishToLinkedIn: async (
    contentId: string,
    articleUrl?: string
  ): Promise<{ success: boolean; post_urn: string; message: string }> => {
    return apiClient(`/integrations/linkedin/publish/${contentId}`, {
      method: 'POST',
      body: JSON.stringify({ article_url: articleUrl }),
    });
  },

  getCloudflareStatus: async (): Promise<{
    configured: boolean;
    account_id?: string;
    model: string;
    message: string;
  }> => {
    return apiClient('/integrations/cloudflare/status');
  },

  generateCloudflareImage: async (payload: {
    prompt: string;
    topic?: string;
    company_name?: string;
    custom_style?: string;
    content_id?: string;
  }): Promise<{
    success: boolean;
    image_url: string;
    public_url?: string;
    prompt: string;
    model: string;
    message: string;
  }> => {
    return apiClient('/integrations/cloudflare/generate-image', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
