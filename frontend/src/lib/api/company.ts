import { apiClient } from './client';
import {
  CategoryListResponse,
  Company,
  GroundedRAGResponse,
  KnowledgeListResponse,
  StructuredFact,
  VerificationStatus,
  WebsiteCrawlJob,
} from '../../types';

export const companyApi = {
  createCompany: async (data: { company_name: string; website_url?: string; industry?: string; company_overview?: string }): Promise<Company> => {
    return apiClient<Company>('/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getCompany: async (companyId: string): Promise<Company> => {
    return apiClient<Company>(`/companies/${companyId}`);
  },

  updateCompany: async (companyId: string, data: Partial<Company>): Promise<Company> => {
    return apiClient<Company>(`/companies/${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  startCrawl: async (companyId: string, websiteUrl: string): Promise<WebsiteCrawlJob> => {
    return apiClient<WebsiteCrawlJob>(`/companies/${companyId}/website-crawls`, {
      method: 'POST',
      body: JSON.stringify({ website_url: websiteUrl }),
    });
  },

  getCrawlStatus: async (companyId: string, jobId: string): Promise<WebsiteCrawlJob> => {
    return apiClient<WebsiteCrawlJob>(`/companies/${companyId}/website-crawls/${jobId}`);
  },

  cancelCrawl: async (companyId: string, jobId: string): Promise<WebsiteCrawlJob> => {
    return apiClient<WebsiteCrawlJob>(`/companies/${companyId}/website-crawls/${jobId}/cancel`, {
      method: 'POST',
    });
  },

  getCategories: async (companyId: string): Promise<CategoryListResponse> => {
    return apiClient<CategoryListResponse>(`/companies/${companyId}/knowledge/categories`);
  },

  getKnowledge: async (
    companyId: string,
    params?: { category_id?: number; verification_status?: string; limit?: number; offset?: number }
  ): Promise<KnowledgeListResponse> => {
    const query = new URLSearchParams();
    if (params?.category_id) query.set('category_id', params.category_id.toString());
    if (params?.verification_status) query.set('verification_status', params.verification_status);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    const qs = query.toString();
    return apiClient<KnowledgeListResponse>(`/companies/${companyId}/knowledge${qs ? `?${qs}` : ''}`);
  },

  verifyFact: async (companyId: string, factId: string, verificationStatus: VerificationStatus): Promise<StructuredFact> => {
    return apiClient<StructuredFact>(`/companies/${companyId}/knowledge/${factId}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ verification_status: verificationStatus }),
    });
  },

  askQuestion: async (companyId: string, query: string): Promise<GroundedRAGResponse> => {
    return apiClient<GroundedRAGResponse>(`/companies/${companyId}/knowledge/answer`, {
      method: 'POST',
      body: JSON.stringify({ company_id: companyId, query }),
    });
  },
};
