export type UserRole = "admin" | "user" | "reviewer";
export type LeadStatus = "active" | "inactive" | "converted";
export type QualificationStatus =
  | "pending"
  | "qualified"
  | "nurture"
  | "unqualified";
export type VerificationStatus =
  | "pending"
  | "verified"
  | "rejected"
  | "conflicting";
export type ApprovalStatus = "draft" | "pending" | "approved" | "rejected";
export type Platform = "linkedin" | "instagram";

export type User = {
  user_id: string;
  company_id: string | null;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

export type Company = {
  company_id: string;
  company_name: string;
  website_url: string | null;
  company_overview: string | null;
  industry: string | null;
  headquarters: string | null;
  created_at: string;
};

export type Category = {
  category_id: number;
  category_name: string;
};

export type KnowledgeSource = {
  source_id: string;
  company_id: string;
  source_url: string;
  source_type: string;
  page_title: string | null;
  last_crawled_at: string | null;
};

export type KnowledgeFact = {
  fact_id: string;
  company_id: string;
  category_id: number;
  source_id: string;
  title: string;
  description: string | null;
  verification_status: VerificationStatus;
  extracted_at: string;
};

export type WebsiteCrawlJob = {
  job_id: string;
  company_id: string;
  source_id: string;
  website_url: string;
  status: "queued" | "running" | "completed" | "failed";
  sitemap_available: boolean;
  pages_discovered: number;
  pages_processed: number;
  sections_saved: number;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type KnowledgeMode = "structured" | "semantic" | "hybrid";

export type StructuredFact = {
  fact_id: string;
  company_id: string;
  category_id: number;
  category_name: string;
  title: string;
  description: string | null;
  source_url: string;
  heading_path: string | null;
  verification_status: string;
  is_current: boolean;
  extracted_at: string | null;
};

export type SemanticChunk = {
  chunk_id: string;
  fact_id: string;
  company_id: string;
  source_url: string;
  heading_path: string | null;
  content: string;
  token_count: number | null;
  score: number | null;
  vector_distance: number | null;
};

export type CompanyKnowledgeContext = {
  company_id: string;
  mode: KnowledgeMode;
  structured_facts: StructuredFact[];
  semantic_results: SemanticChunk[];
  context_text: string;
  total_facts: number;
  total_chunks: number;
};

export type KnowledgeIndexResult = {
  status: string;
  company_id: string;
  eligible_facts: number;
  facts_processed: number;
  chunks_created: number;
  chunks_updated: number;
  chunks_unchanged: number;
  chunks_deactivated: number;
};

export type Lead = {
  lead_id: string;
  company_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  organization_name: string | null;
  job_title: string | null;
  industry: string | null;
  lead_status: LeadStatus;
  created_at: string;
  updated_at: string;
};

export type Qualification = {
  qualification_id: string;
  company_id: string;
  lead_id: string;
  source_id: string | null;
  date_id: number;
  lead_score: number | null;
  confidence_score: number | null;
  intent_level: "unknown" | "low" | "medium" | "high";
  qualification_status: QualificationStatus;
  qualification_reason: string | null;
  recommended_action: string | null;
  scoring_version: string | null;
  evaluated_at: string;
  created_at: string;
};

export type MarketingContent = {
  content_id: string;
  company_id: string;
  content_title: string;
  content_type: string;
  platform_target: Platform;
  topic: string | null;
  content_text: string;
  tone: string | null;
  generation_type: "ai" | "manual";
  approval_status: ApprovalStatus;
  created_at: string;
};

export type SocialAccount = {
  social_account_id: string;
  company_id: string;
  platform: Platform;
  external_account_id: string;
  account_name: string | null;
  account_handle: string | null;
  account_type: string | null;
  connection_status: "connected" | "disconnected" | "expired";
  connected_at: string | null;
};

export type PerformanceRecord = {
  performance_id: string;
  company_id: string;
  content_id: string;
  social_account_id: string;
  date_id: number;
  published_post_id: string;
  collected_at: string;
  impressions: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  video_views: number | null;
  metric_period: "daily" | "lifetime";
  metric_source: string | null;
  retrieval_status: string;
  created_at: string;
};

export type ListResponse<T> = {
  total: number;
  items: T[];
};
