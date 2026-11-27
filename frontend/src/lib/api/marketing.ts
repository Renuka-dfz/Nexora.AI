import { apiClient } from './client';
import { ContentItem, ContentListResponse, ContentGenerationBatch, Platform } from '../../types';

export interface GenerateContentPayload {
  topic: string;
  platform?: Platform;
  content_type?: string;
  tone?: string;
  instructions?: string;
  multi_stage?: boolean;
}

export const marketingApi = {
  getSummary: async (companyId: string): Promise<import('../../types').MarketingSummaryResponse> => {
    return apiClient<import('../../types').MarketingSummaryResponse>(`/marketing/summary?company_id=${companyId}`);
  },

  listContent: async (
    companyId: string,
    params?: {
      status?: string;
      publish_status?: string;
      generation_batch_id?: string;
      platform?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<ContentListResponse> => {
    const query = new URLSearchParams({ company_id: companyId });
    if (params?.status) query.set('status', params.status);
    if (params?.publish_status) query.set('publish_status', params.publish_status);
    if (params?.generation_batch_id) query.set('generation_batch_id', params.generation_batch_id);
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

  generateWeeklyPlan: async (payload: {
    platform: Platform;
    mode: 'automatic' | 'manual';
    content_type: 'post' | 'article' | 'image' | 'video';
    prompt?: string;
    tone?: string;
    instructions?: string;
  }): Promise<ContentGenerationBatch> => {
    return apiClient<ContentGenerationBatch>('/marketing/content/generate-weekly', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getWeeklyPlan: async (batchId: string): Promise<ContentGenerationBatch> => {
    return apiClient<ContentGenerationBatch>(`/marketing/content/batches/${batchId}`);
  },

  getLatestWeeklyPlan: async (): Promise<ContentGenerationBatch | null> => {
    return apiClient<ContentGenerationBatch | null>('/marketing/content/batches/latest');
  },

  runWeeklyGenerationNow: async (platform?: Platform): Promise<ContentGenerationBatch> => {
    const p = platform || 'instagram';
    return apiClient<ContentGenerationBatch>(`/marketing/campaigns/run-weekly-now?platform=${p}`, {
      method: 'POST',
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
    contentId: string
  ): Promise<{ success: boolean; media_id: string; message: string }> => {
    return apiClient(`/integrations/instagram/publish/${contentId}`, {
      method: 'POST',
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

  generateOpenRouterImage: async (payload: {
    prompt: string;
    topic?: string;
    company_name?: string;
    headline?: string;
    pillars?: string[];
    custom_style?: string;
    content_id?: string;
    size?: '1:1' | '4:5' | '16:9';
  }): Promise<{
    success: boolean;
    image_url: string;
    public_url?: string;
    prompt: string;
    model: string;
    message: string;
  }> => {
    return apiClient('/integrations/openrouter/generate-image', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  generateRecraftImage: async (payload: {
    prompt: string;
    topic?: string;
    company_name?: string;
    custom_style?: string;
    content_id?: string;
    size?: '1:1' | '4:5' | '16:9';
  }): Promise<{
    success: boolean;
    image_url: string;
    public_url?: string;
    prompt: string;
    model: string;
    message: string;
  }> => {
    return apiClient('/integrations/openrouter/generate-image', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
