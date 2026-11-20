import { apiClient } from './client';
import { Lead, Qualification } from '../../types';

export const leadsApi = {
  listLeads: async (companyId: string): Promise<{ total: number; items: Lead[] }> => {
    return apiClient<{ total: number; items: Lead[] }>(`/leads?company_id=${companyId}`);
  },

  getLead: async (leadId: string): Promise<Lead> => {
    return apiClient<Lead>(`/leads/${leadId}`);
  },

  getLatestQualification: async (leadId: string): Promise<Qualification> => {
    return apiClient<Qualification>(`/leads/${leadId}/qualifications/latest`);
  },

  createLead: async (data: {
    company_id: string;
    full_name?: string;
    email?: string;
    organization_name?: string;
    job_title?: string;
    industry?: string;
  }): Promise<Lead> => {
    return apiClient<Lead>('/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  evaluateLead: async (leadId: string, inquiryText: string): Promise<Qualification> => {
    return apiClient<Qualification>(`/leads/${leadId}/evaluate`, {
      method: 'POST',
      body: JSON.stringify({ inquiry_text: inquiryText }),
    });
  },
};
