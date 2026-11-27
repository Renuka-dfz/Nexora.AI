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
  generation_batch_id?: string | null;
  image_url?: string | null;
  caption?: string | null;
  hashtags?: string | null;
  scheduled_at?: string | null;
  published_at?: string | null;
  published_post_id?: string | null;
  publish_status?: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  publish_error?: string | null;
}

export interface ContentGenerationBatch {
  batch_id: string;
  company_id: string;
  platform: Platform;
  mode: 'automatic' | 'manual';
  status: 'queued' | 'generating' | 'completed' | 'partial' | 'failed';
  prompt?: string | null;
  total_requested: number;
  total_created: number;
  error_message?: string | null;
  created_at: string;
  completed_at?: string | null;
  posts: ContentItem[];
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

export interface CrawledPageItem {
  page_id: string;
  page_url: string;
  title: string;
  meta_description?: string | null;
  crawl_status: 'success' | 'failed' | 'skipped' | string;
  change_status: 'changed' | 'unchanged' | 'failed';
  crawled_at: string | null;
  error_message?: string | null;
}

export interface CrawlTelemetryResponse {
  company_id: string;
  total: number;
  items: CrawledPageItem[];
  summary: {
    total_pages: number;
    changed_count: number;
    unchanged_count: number;
    failed_count: number;
  };
  latest_job?: {
    job_id: string | null;
    status: string;
    pages_crawled: number;
    started_at?: string | null;
    finished_at?: string | null;
    error_message?: string | null;
  } | null;
}

export interface MarketingSummaryResponse {
  company_id: string;
  crawled_pages: number;
  generated_posts: number;
  scheduled_posts: number;
  pending_reviews: number;
}

