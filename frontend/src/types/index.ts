export type UserRole = 'admin' | 'user' | 'reviewer';

export interface User {
  user_id: string;
  email: string;
  role: UserRole;
  company_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user?: User;
}

export interface Company {
  company_id: string;
  company_name: string;
  website_url?: string;
  company_overview?: string;
  industry?: string;
  headquarters?: string;
  created_at: string;
}

export type Platform = 'linkedin' | 'instagram';
export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type GenerationType = 'ai' | 'manual';

export interface ContentItem {
  content_id: string;
  company_id: string;
  content_title: string;
  content_type: string;
  platform_target: Platform | string;
  topic?: string;
  content_text: string;
  tone?: string;
  generation_type: GenerationType;
  approval_status: ApprovalStatus;
  created_at: string;
}

export interface ContentListResponse {
  total: number;
  items: ContentItem[];
}

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'conflicting';

export interface StructuredFact {
  fact_id: string;
  company_id: string;
  category_id: number;
  category_name?: string;
  source_id: string;
  source_url?: string;
  page_title?: string;
  title: string;
  description?: string;
  heading_path?: string;
  verification_status: VerificationStatus;
  is_current: boolean;
  extracted_at: string;
}

export interface KnowledgeListResponse {
  company_id: string;
  total: number;
  items: StructuredFact[];
}

export interface Category {
  category_id: number;
  category_name: string;
}

export interface CategoryListResponse {
  total: number;
  items: Category[];
}

export interface WebsiteCrawlJob {
  job_id: string;
  company_id: string;
  website_url: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  pages_discovered: number;
  pages_processed: number;
  sections_saved: number;
  created_at: string;
  finished_at?: string;
}

export interface GroundedRAGResponse {
  answer: string;
  confidence_score: number;
  factual_grounding_score: number;
  is_grounded: boolean;
  citations: Array<{
    title: string;
    source_url: string;
    section?: string;
  }>;
}

export interface TeamMember {
  user_id: string;
  company_id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface InvitationRead {
  email: string;
  role: UserRole;
  company_id: string;
  company_name?: string;
  expires_at: string;
  invitation_token: string;
  invite_url: string;
}

export interface InvitationVerifyResponse {
  email: string;
  role: UserRole;
  company_id: string;
  company_name?: string;
  expires_at: string;
}

export interface Lead {
  lead_id: string;
  company_id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  organization_name?: string;
  job_title?: string;
  industry?: string;
  lead_status: 'active' | 'inactive' | 'converted';
  created_at: string;
}

export interface Qualification {
  qualification_id: string;
  company_id: string;
  lead_id: string;
  lead_score?: number;
  confidence_score?: number;
  intent_level: 'unknown' | 'low' | 'medium' | 'high';
  qualification_status: 'pending' | 'qualified' | 'nurture' | 'unqualified';
  qualification_reason?: string;
  recommended_action?: string;
  evaluated_at: string;
}
