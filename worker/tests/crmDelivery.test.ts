import { deepEqual, equal } from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { deliverCrmRecord, forwardsToCrm, qualifiesForCrm } from "../src/crmDelivery";
import { placeRecordId, TwentyClient, type Company, type CompanyEvidence } from "../src/twenty";

const evidence: CompanyEvidence = {
  name: "Officina Rossi",
  sourceUrl: "https://officina.example/chi-siamo",
  website: "https://officina.example",
  street: "Via Roma 1",
  city: "Bergamo",
};
const googlePlaceId = "ChIJ-regression-fixture";
const opportunityId = placeRecordId("opportunity", googlePlaceId);
const companyId = placeRecordId("company", googlePlaceId);
const otherCompanyId = "4bc24095-ddae-4598-bd57-0635bc5d41a9";
const token = "claim";
const webhook = { url: new URL("https://crm.example/webhooks/workflows/workspace/workflow"), password: "fixture" };

function fixture(context: TestContext, candidates: Company[] = []) {
  const state: Parameters<typeof deliverCrmRecord>[1] = {
    placeId: "fixture",
    place: { placeId: googlePlaceId },
    status: "processing",
    evidence: { ...evidence },
    candidates: null,
    companyId: null,
    opportunityId: null,
    createCompany: false,
    attempts: 1,
    dueAt: new Date(),
    leaseToken: token,
    message: null,
    updatedAt: new Date(),
  };
  const db = {
    crmDelivery: {
      async updateMany({ where, data }: { where: { leaseToken: string }; data: object }) {
        if (state.leaseToken !== where.leaseToken) return { count: 0 };
        Object.assign(state, data);
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
  const companies = new Map(candidates.map((company) => [company.id, company]));
  const opportunities = new Map<string, { id: string; companyId: string; name: string; stage: string }>();
  const posts: boolean[] = [];
  let failOpportunity = false;
  const missing = () => new Response(null, { status: 404 });

  context.mock.method(globalThis, "fetch", async (url: URL, options: RequestInit) => {
    const [, , object, recordId] = url.pathname.split("/");
    if (options.method === "POST") {
      equal(url.href, webhook.url.href);
      const body = JSON.parse(String(options.body));
      equal(body.event, "lead.verified");
      equal(body.name, evidence.name);
      equal(body.phone, undefined);
      equal(body.pointOfContactId, undefined);
      equal(new Headers(options.headers).get("authorization"), "Basic " + Buffer.from("lead-scraper:fixture").toString("base64"));
      posts.push(body.createCompany);
      if (body.createCompany) {
        companies.set(body.companyId, {
          id: body.companyId, name: body.name,
          domainName: { primaryLinkUrl: body.website },
          address: { addressStreet1: body.street, addressCity: body.city },
        });
      }
      if (failOpportunity) return new Response(null, { status: 503 });
      opportunities.set(body.opportunityId, {
        id: body.opportunityId, companyId: body.companyId, name: body.name, stage: "NEW",
      });
      return Response.json({ success: true, workflowRunId: "fixture" }, { status: 201 });
    }
    if (object === "companies" && !recordId) {
      return Response.json({ data: { companies: candidates }, pageInfo: { hasNextPage: false } });
    }
    if (object === "companies") {
      const row = companies.get(recordId);
      return row ? Response.json({ data: { company: row } }) : missing();
    }
    equal(object, "opportunities");
    const row = opportunities.get(recordId);
    return row ? Response.json({ data: { opportunity: row } }) : missing();
  });
  const deliver = () => {
    state.leaseToken = token;
    return deliverCrmRecord(db, { ...state }, token, new TwentyClient(new URL("https://crm.example"), "fixture"), webhook);
  };
  return { state, deliver, companies, opportunities, posts, setFailure: (fail: boolean) => { failOpportunity = fail; } };
}

test("crea azienda e opportunità senza referente e recupera una consegna ripetuta", async (context) => {
  const { state, deliver, companies, opportunities, posts } = fixture(context);
  await deliver();
  await deliver();
  equal(state.status, "delivered");
  deepEqual(posts, [true]);
  deepEqual(companies.get(companyId), {
    id: companyId, name: evidence.name, domainName: { primaryLinkUrl: evidence.website },
    address: { addressStreet1: evidence.street, addressCity: evidence.city },
  });
  deepEqual(opportunities.get(opportunityId), { id: opportunityId, companyId, name: evidence.name, stage: "NEW" });
});

test("riutilizza l’azienda CRM con nome e indirizzo verificati", async (context) => {
  const candidate = { id: otherCompanyId, name: "OFFICINA ROSSI", address: { addressStreet1: evidence.street, addressCity: evidence.city } };
  const { deliver, opportunities, posts } = fixture(context, [candidate]);
  await deliver();
  equal(opportunities.get(opportunityId)?.companyId, otherCompanyId);
  deepEqual(posts, [false]);
});

test("attende una scelta quando il CRM ha un omonimo da verificare", async (context) => {
  const { state, deliver, opportunities, posts } = fixture(context, [{ id: otherCompanyId, name: evidence.name }]);
  await deliver();
  equal(state.status, "review");
  deepEqual(posts, []);
  state.companyId = otherCompanyId;
  await deliver();
  equal(state.status, "delivered");
  equal(opportunities.get(opportunityId)?.companyId, otherCompanyId);
});

test("recupera un errore dopo la creazione dell’azienda", async (context) => {
  const { state, deliver, posts, setFailure } = fixture(context);
  setFailure(true);
  await deliver();
  equal(state.status, "pending");
  equal(state.companyId, companyId);
  state.attempts++;
  setFailure(false);
  await deliver();
  equal(state.status, "delivered");
  deepEqual(posts, [true, false]);
});

test("attende la conferma del nome prima di effettuare chiamate al CRM", async (context) => {
  const { state, deliver, posts } = fixture(context);
  state.evidence = null;
  await deliver();
  equal(state.status, "review");
  deepEqual(posts, []);
  state.evidence = { ...evidence };
  await deliver();
  equal(state.status, "delivered");
});

test("esclude storico e anteprime dalla consegna", () => {
  const cutoff = new Date("2026-11-16T14:00:00Z");
  equal(qualifiesForCrm({ previewOnly: false, firstSeenAt: new Date(cutoff.getTime() - 1) }, cutoff), false);
  equal(qualifiesForCrm({ previewOnly: true, firstSeenAt: cutoff }, cutoff), false);
  equal(qualifiesForCrm({ previewOnly: false, firstSeenAt: cutoff }, cutoff), true);
});

test("la lista deve puntare esattamente al webhook MDNT", () => {
  equal(forwardsToCrm(null, webhook.url.href), false);
  equal(forwardsToCrm("https://automation.example/webhook", webhook.url.href), false);
  equal(forwardsToCrm(webhook.url.href, webhook.url.href), true);
});
