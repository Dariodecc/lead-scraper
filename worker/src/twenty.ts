import { createHash } from "node:crypto";

export interface CompanyEvidence {
  name: string;
  sourceUrl: string;
  website?: string;
  street?: string;
  city?: string;
  postcode?: string;
}

export interface Company {
  id: string;
  name: string;
  domainName?: { primaryLinkUrl?: string | null } | null;
  address?: {
    addressStreet1?: string | null;
    addressCity?: string | null;
    addressPostcode?: string | null;
  } | null;
}

export interface TwentyWebhook {
  url: URL;
  password: string;
}

interface Opportunity {
  id: string;
  companyId: string | null;
}

interface TwentyResponse {
  data: Record<string, unknown>;
  pageInfo?: { hasNextPage: boolean; endCursor: string | null };
}

export class TwentyError extends Error {
  constructor(readonly status: number, reason: string) {
    super(reason);
  }

  get retryable() {
    return this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

export const normalizeName = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

function domain(value?: string | null) {
  if (!value) return "";
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function verifiedCompany(evidence: CompanyEvidence, companies: Company[]) {
  const website = domain(evidence.website);
  const matches = companies.filter((company) => {
    if (normalizeName(company.name) !== normalizeName(evidence.name)) return false;
    if (website && website === domain(company.domainName?.primaryLinkUrl)) return true;
    if (!evidence.street || !evidence.city || !company.address) return false;

    const same = (left: string, right?: string | null) =>
      !!right && normalizeName(left) === normalizeName(right);
    return same(evidence.street, company.address.addressStreet1)
      && same(evidence.city, company.address.addressCity)
      && (!evidence.postcode || !company.address.addressPostcode
        || same(evidence.postcode, company.address.addressPostcode));
  });
  return matches.length === 1 ? matches[0] : null;
}

const UUID_NAMESPACE = Buffer.from("cf4159916c8d4370bdc14ed8df26a59c", "hex");

export function placeRecordId(type: "company" | "opportunity", placeId: string) {
  const bytes = createHash("sha1").update(UUID_NAMESPACE).update(`${type}:${placeId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class TwentyClient {
  constructor(private readonly baseUrl: URL, private readonly apiKey: string) {}

  private async request(path: string): Promise<TwentyResponse> {
    const response = await fetch(new URL(`/rest/${path}`, this.baseUrl), {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new TwentyError(response.status, `Twenty ha risposto HTTP ${response.status}.`);
    return response.json() as Promise<TwentyResponse>;
  }

  private async find<T>(path: string, key: string): Promise<T | null> {
    try {
      return (await this.request(path)).data[key] as T;
    } catch (error) {
      if (error instanceof TwentyError && error.status === 404) return null;
      throw error;
    }
  }

  company(id: string) {
    return this.find<Company>(`companies/${id}?fields=id,name,domainName,address`, "company");
  }

  opportunity(id: string) {
    return this.find<Opportunity>(`opportunities/${id}?fields=id,companyId&depth=0`, "opportunity");
  }

  async candidates(evidence: CompanyEvidence): Promise<Company[]> {
    const name = evidence.name.replace(/[\\%_]/g, "\\$&");
    const comparisons = [`name[ilike]:${JSON.stringify(name)}`];
    const website = domain(evidence.website);
    if (website) comparisons.push(`domainName.primaryLinkUrl[ilike]:${JSON.stringify(`%${website}%`)}`);
    const filter = comparisons.length === 1 ? comparisons[0] : `or(${comparisons.join(",")})`;
    const params = new URLSearchParams({ fields: "id,name,domainName,address", filter, limit: "60" });
    const candidates: Company[] = [];
    for (let page = 0; page < 10; page++) {
      const response = await this.request(`companies?${params}`);
      const companies = response.data.companies as Company[];
      candidates.push(...companies.filter((company) =>
        normalizeName(company.name) === normalizeName(evidence.name)
        || (website && website === domain(company.domainName?.primaryLinkUrl))));
      if (!response.pageInfo?.hasNextPage) return candidates;
      if (!response.pageInfo.endCursor) break;
      params.set("starting_after", response.pageInfo.endCursor);
    }
    throw new TwentyError(422, "Troppe corrispondenze CRM per verificare l’azienda automaticamente.");
  }

  async triggerLeadWorkflow(
    webhook: TwentyWebhook,
    evidence: CompanyEvidence,
    companyId: string,
    opportunityId: string,
    createCompany: boolean,
  ) {
    const auth = Buffer.from(`lead-scraper:${webhook.password}`).toString("base64");
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "lead.verified",
        companyId,
        opportunityId,
        createCompany,
        name: evidence.name,
        website: evidence.website ?? "",
        street: evidence.street ?? "",
        city: evidence.city ?? "",
        postcode: evidence.postcode ?? "",
      }),
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new TwentyError(response.status, `Webhook MDNT: HTTP ${response.status}.`);
    const result = await response.json() as { success?: boolean; workflowRunId?: string };
    if (!result.success || !result.workflowRunId) {
      throw new TwentyError(502, "Il webhook MDNT non ha confermato l’avvio del workflow.");
    }
  }
}
