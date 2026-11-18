import type {
  Category,
  Company,
  CompanyKnowledgeContext,
  KnowledgeIndexResult,
  KnowledgeFact,
  KnowledgeMode,
  KnowledgeSource,
  Lead,
  ListResponse,
  MarketingContent,
  PerformanceRecord,
  Platform,
  Qualification,
  SocialAccount,
  User,
  UserRole,
  VerificationStatus,
  WebsiteCrawlJob,
} from "../types/api";

const TOKEN_KEY = "nexora.accessToken";
const API_BASE = "/api/v1";

export type ApiHealth = { status: "ok" };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");

  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(
      "Could not reach the API. Check that the backend is running.",
      0,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = getErrorMessage(payload, response.status);
    if (response.status === 401) {
      clearAccessToken();
      window.dispatchEvent(new Event("nexora:unauthorized"));
    }
    throw new ApiError(message, response.status);
  }

  if (payload === null) {
    throw new ApiError("API returned an empty or invalid JSON response", 502);
  }

  return payload as T;
}

function getErrorMessage(payload: unknown, status: number): string {
  if (typeof payload !== "object" || payload === null || !("detail" in payload)) {
    return `Request failed (${status})`;
  }
  if (typeof payload.detail === "string") {
    return payload.detail;
  }
  if (
    typeof payload.detail === "object" &&
    payload.detail !== null &&
    "message" in payload.detail &&
    typeof payload.detail.message === "string"
  ) {
    return payload.detail.message;
  }
  if (Array.isArray(payload.detail)) {
    const firstIssue: unknown = payload.detail[0];
    if (
      typeof firstIssue === "object" &&
      firstIssue !== null &&
      "msg" in firstIssue &&
      typeof firstIssue.msg === "string"
    ) {
      return firstIssue.msg;
    }
  }
  return `Request failed (${status})`;
}

function queryString(values: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  const result = query.toString();
  return result ? `?${result}` : "";
}

export async function getApiHealth(signal?: AbortSignal): Promise<ApiHealth> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/health`, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(
      "Could not reach the API. Check that the backend is running.",
      0,
    );
  }
  if (!response.ok) {
    throw new ApiError(`Backend health check failed (${response.status})`, response.status);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("Backend returned invalid JSON from the health endpoint", 502);
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("status" in payload) ||
    payload.status !== "ok"
  ) {
    throw new ApiError("Backend returned an unexpected health response", 502);
  }
  return { status: "ok" };
}

export type AuthResult = { access_token: string; token_type: string };
export type RegisterResult = AuthResult & { user: User };

export function login(email: string, password: string) {
  return request<AuthResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(email: string, password: string) {
  return request<RegisterResult>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getCurrentUser() {
  return request<User>("/auth/me");
}

export function getCompany(companyId: string) {
  return request<Company>(`/companies/${companyId}`);
}

export function createCompany(input: {
  company_name: string;
  website_url?: string;
  company_overview?: string;
  industry?: string;
  headquarters?: string;
}) {
  return request<Company>("/companies", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCompany(
  companyId: string,
  input: Partial<
    Pick<Company, "company_name" | "website_url" | "company_overview" | "industry" | "headquarters">
  >,
) {
  return request<Company>(`/companies/${companyId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function getCategories(companyId: string) {
  return request<ListResponse<Category>>(
    `/companies/${companyId}/knowledge/categories`,
  );
}

export function getSources(companyId: string) {
  return request<{ company_id: string } & ListResponse<KnowledgeSource>>(
    `/companies/${companyId}/sources`,
  );
}

export function createSource(
  companyId: string,
  input: { source_url: string; source_type?: string; page_title?: string },
) {
  return request<KnowledgeSource>(`/companies/${companyId}/sources`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function startWebsiteCrawl(companyId: string, websiteUrl: string) {
  return request<WebsiteCrawlJob>(`/companies/${companyId}/website-crawls`, {
    method: "POST",
    body: JSON.stringify({ website_url: websiteUrl }),
  });
}

export function getWebsiteCrawlStatus(companyId: string, jobId: string) {
  return request<WebsiteCrawlJob>(
    `/companies/${companyId}/website-crawls/${jobId}`,
  );
}

export function queryCompanyKnowledge(
  companyId: string,
  input: { query: string; mode: KnowledgeMode },
) {
  return request<CompanyKnowledgeContext>(
    `/companies/${companyId}/knowledge/query`,
    {
      method: "POST",
      body: JSON.stringify({ company_id: companyId, ...input }),
    },
  );
}

export function indexCompanyKnowledge(companyId: string) {
  return request<KnowledgeIndexResult>(`/companies/${companyId}/rag/index`, {
    method: "POST",
  });
}

export function getKnowledge(
  companyId: string,
  filters: { category_id?: number; verification_status?: VerificationStatus } = {},
) {
  return request<{ company_id: string } & ListResponse<KnowledgeFact>>(
    `/companies/${companyId}/knowledge${queryString(filters)}`,
  );
}

export function createKnowledge(
  companyId: string,
  input: {
    source_id: string;
    category_id: number;
    title: string;
    description?: string;
  },
) {
  return request<KnowledgeFact>(`/companies/${companyId}/knowledge`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function verifyKnowledge(
  companyId: string,
  factId: string,
  verification_status: "verified" | "rejected",
) {
  return request<KnowledgeFact>(
    `/companies/${companyId}/knowledge/${factId}/verification`,
    { method: "PATCH", body: JSON.stringify({ verification_status }) },
  );
}

export function getLeads(companyId: string) {
  return request<ListResponse<Lead>>(
    `/leads${queryString({ company_id: companyId, limit: 100 })}`,
  );
}

export function createLead(
  companyId: string,
  input: {
    full_name?: string;
    email?: string;
    phone?: string;
    organization_name?: string;
    job_title?: string;
    industry?: string;
  },
) {
  return request<Lead>("/leads", {
    method: "POST",
    body: JSON.stringify({ company_id: companyId, ...input }),
  });
}

export function createQualification(
  leadId: string,
  input: {
    lead_score?: number;
    confidence_score?: number;
    intent_level: "unknown" | "low" | "medium" | "high";
    qualification_status: "pending" | "qualified" | "nurture" | "unqualified";
    qualification_reason?: string;
    recommended_action?: string;
  },
) {
  return request<Qualification>(`/leads/${leadId}/qualifications`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getContent(companyId: string) {
  return request<ListResponse<MarketingContent>>(
    `/marketing/content${queryString({ company_id: companyId, limit: 100 })}`,
  );
}

export function createContent(
  companyId: string,
  input: {
    content_title: string;
    content_type: string;
    platform_target: Platform;
    content_text: string;
    topic?: string;
    tone?: string;
  },
) {
  return request<MarketingContent>("/marketing/content", {
    method: "POST",
    body: JSON.stringify({
      company_id: companyId,
      generation_type: "manual",
      ...input,
    }),
  });
}

export function transitionContent(
  contentId: string,
  transition: "submit" | "approve" | "reject",
) {
  return request<MarketingContent>(
    `/marketing/content/${contentId}/${transition}`,
    { method: "POST" },
  );
}

export function getPerformance(companyId: string) {
  return request<ListResponse<PerformanceRecord>>(
    `/marketing/performance${queryString({ company_id: companyId, limit: 100 })}`,
  );
}

export function getSocialAccounts(companyId: string) {
  return request<ListResponse<SocialAccount>>(
    `/marketing/social-accounts${queryString({ company_id: companyId })}`,
  );
}

export function createSocialAccount(
  companyId: string,
  input: {
    platform: Platform;
    external_account_id: string;
    account_name?: string;
    account_handle?: string;
    account_type?: string;
  },
) {
  return request<SocialAccount>("/marketing/social-accounts", {
    method: "POST",
    body: JSON.stringify({ company_id: companyId, ...input }),
  });
}

export function roleCanWrite(role: UserRole | undefined) {
  return role === "admin" || role === "user";
}

export function roleCanReview(role: UserRole | undefined) {
  return role === "admin" || role === "reviewer";
}
