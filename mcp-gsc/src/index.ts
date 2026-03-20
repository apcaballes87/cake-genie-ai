import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { GoogleAdsApi, enums } from "google-ads-api";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

// ─── Google Ads client ────────────────────────────────────────────────────────

function getCredentials() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;

  if (!clientId || !clientSecret || !developerToken || !refreshToken || !customerId) {
    throw new Error(
      "Missing Google Ads credentials. Required in .env.local:\n" +
        "  GOOGLE_ADS_CLIENT_ID\n" +
        "  GOOGLE_ADS_CLIENT_SECRET\n" +
        "  GOOGLE_ADS_DEVELOPER_TOKEN\n" +
        "  GOOGLE_ADS_REFRESH_TOKEN\n" +
        "  GOOGLE_ADS_CUSTOMER_ID"
    );
  }

  return { clientId, clientSecret, developerToken, refreshToken, customerId };
}

function getCustomer() {
  const { clientId, clientSecret, developerToken, refreshToken, customerId } =
    getCredentials();

  const client = new GoogleAdsApi({
    client_id: clientId,
    client_secret: clientSecret,
    developer_token: developerToken,
  });

  return {
    customer: client.Customer({ customer_id: customerId, refresh_token: refreshToken }),
    customerId,
  };
}

// ─── Philippine city geo target constants ─────────────────────────────────────
const PH_CITY_GEO_TARGETS: Record<string, string> = {
  // National
  Philippines:      "2608",
  // NCR / Metro Manila
  "Metro Manila":   "1003913",
  Manila:           "1015107",
  "Quezon City":    "1015055",
  Makati:           "1015060",
  Pasig:            "1015063",
  Taguig:           "1015068",
  BGC:              "1015068",
  Mandaluyong:      "1015061",
  Marikina:         "1015062",
  "Parañaque":      "1015064",
  "Las Piñas":      "1015059",
  Muntinlupa:       "1015057",
  Caloocan:         "1015054",
  Pasay:            "1015058",
  Malabon:          "1015056",
  Navotas:          "1015065",
  "San Juan":       "1015066",
  Valenzuela:       "1015067",
  Pateros:          "1015053",
  // Visayas / Mindanao / Luzon
  "Cebu City":      "9070344",
  "Lapu-Lapu City": "9070345",
  Mandaue:          "9070346",
  "Davao City":     "1003926",
  "Cagayan de Oro": "1003928",
  "Zamboanga City": "1003930",
  "General Santos": "1003929",
  "Iloilo City":    "1003916",
  Bacolod:          "1003915",
  Baguio:           "1003910",
  Pampanga:         "1003912",
  Bulacan:          "1003909",
  Cavite:           "1003911",
  Laguna:           "1003914",
  Rizal:            "1003917",
  Batangas:         "1003908",
};

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "keyword-discovery",
  version: "1.0.0",
});

// ─── Tool 1: Generate Local Keyword Combos (no API needed) ───────────────────

server.tool(
  "generate_local_combos",
  "Generate [service] × [city] keyword combinations for local SEO. No API key needed.",
  {
    services: z
      .array(z.string())
      .describe(
        'List of services. E.g. ["custom cakes", "wedding cakes", "birthday cakes"]'
      ),
    cities: z
      .array(z.string())
      .describe('List of cities. E.g. ["Manila", "Quezon City", "Cebu City"]'),
    templates: z
      .array(z.string())
      .optional()
      .describe(
        "Keyword templates using {service} and {city} placeholders. " +
          'Defaults: ["{service} {city}", "{service} in {city}", "best {service} {city}", "{service} delivery {city}"]'
      ),
  },
  async ({ services, cities, templates }) => {
    const defaultTemplates = [
      "{service} {city}",
      "{service} in {city}",
      "best {service} {city}",
      "{service} delivery {city}",
      "{service} near {city}",
    ];
    const tpls = templates && templates.length > 0 ? templates : defaultTemplates;
    const combos: string[] = [];

    for (const service of services) {
      for (const city of cities) {
        for (const tpl of tpls) {
          combos.push(
            tpl.replace("{service}", service.toLowerCase()).replace("{city}", city)
          );
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              total: combos.length,
              breakdown: `${services.length} services × ${cities.length} cities × ${tpls.length} templates`,
              keywords: combos,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool 2: Discover Keywords via Google Ads Keyword Planner ────────────────

server.tool(
  "discover_keywords",
  "Discover new keyword opportunities using Google Ads Keyword Planner. Returns search volume, competition, and CPC for keyword ideas around your seed terms.",
  {
    seed_keywords: z
      .array(z.string())
      .describe('Seed keywords. E.g. ["custom cakes Manila", "wedding cake delivery"]'),
    location: z
      .string()
      .optional()
      .default("Philippines")
      .describe(
        `Target location. Available: ${Object.keys(PH_CITY_GEO_TARGETS).join(", ")}`
      ),
    language_id: z
      .string()
      .optional()
      .default("1000")
      .describe("Google language ID. 1000 = English (default)."),
    min_search_volume: z
      .number()
      .optional()
      .default(10)
      .describe("Exclude keywords with average monthly searches below this number."),
  },
  async ({ seed_keywords, location, language_id, min_search_volume }) => {
    const { customer, customerId } = getCustomer();

    const loc = location ?? "Philippines";
    const geoTarget = PH_CITY_GEO_TARGETS[loc];
    if (!geoTarget) {
      return {
        content: [
          {
            type: "text",
            text: `Unknown location: "${loc}". Available: ${Object.keys(PH_CITY_GEO_TARGETS).join(", ")}`,
          },
        ],
      };
    }

    const response = await customer.keywordPlanIdeas.generateKeywordIdeas({
      customer_id: customerId,
      keyword_seed: { keywords: seed_keywords },
      geo_target_constants: [`geoTargetConstants/${geoTarget}`],
      language: `languageConstants/${language_id ?? "1000"}`,
      include_adult_keywords: false,
      keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH_AND_PARTNERS,
    } as any);

    const minVol = min_search_volume ?? 10;
    const results = (response.results ?? [])
      .map((idea: any) => ({
        keyword: idea.text,
        avg_monthly_searches: idea.keyword_idea_metrics?.avg_monthly_searches ?? 0,
        competition: idea.keyword_idea_metrics?.competition ?? "UNKNOWN",
        low_cpc_micros: idea.keyword_idea_metrics?.low_top_of_page_bid_micros ?? 0,
        high_cpc_micros: idea.keyword_idea_metrics?.high_top_of_page_bid_micros ?? 0,
      }))
      .filter((k: any) => k.avg_monthly_searches >= minVol)
      .sort((a: any, b: any) => b.avg_monthly_searches - a.avg_monthly_searches);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              location: loc,
              seed_keywords,
              total_results: results.length,
              note: "low/high_cpc_micros are in micros (divide by 1,000,000 for PHP)",
              keywords: results,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool 3: Get Search Volume for a Specific List ───────────────────────────

server.tool(
  "get_keyword_volume",
  "Get real search volume and competition data for a specific list of keywords. Use this to validate combos generated by generate_local_combos.",
  {
    keywords: z
      .array(z.string())
      .describe("List of exact keywords to check. Max 1000 per call."),
    location: z
      .string()
      .optional()
      .default("Philippines")
      .describe("Target location name."),
    language_id: z
      .string()
      .optional()
      .default("1000")
      .describe("Google language ID. 1000 = English."),
  },
  async ({ keywords, location, language_id }) => {
    const { customer, customerId } = getCustomer();

    const loc = location ?? "Philippines";
    const geoTarget = PH_CITY_GEO_TARGETS[loc];
    if (!geoTarget) {
      return {
        content: [
          {
            type: "text",
            text: `Unknown location: "${loc}". Available: ${Object.keys(PH_CITY_GEO_TARGETS).join(", ")}`,
          },
        ],
      };
    }

    const response = await customer.keywordPlanIdeas.generateKeywordIdeas({
      customer_id: customerId,
      keyword_seed: { keywords },
      geo_target_constants: [`geoTargetConstants/${geoTarget}`],
      language: `languageConstants/${language_id ?? "1000"}`,
      include_adult_keywords: false,
      keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH_AND_PARTNERS,
    } as any);

    // Return only exact matches from the input list
    const inputSet = new Set(keywords.map((k) => k.toLowerCase().trim()));
    const results = (response.results ?? [])
      .filter((idea: any) =>
        inputSet.has((idea.text ?? "").toLowerCase().trim())
      )
      .map((idea: any) => ({
        keyword: idea.text,
        avg_monthly_searches: idea.keyword_idea_metrics?.avg_monthly_searches ?? 0,
        competition: idea.keyword_idea_metrics?.competition ?? "UNKNOWN",
        low_cpc_micros: idea.keyword_idea_metrics?.low_top_of_page_bid_micros ?? 0,
        high_cpc_micros: idea.keyword_idea_metrics?.high_top_of_page_bid_micros ?? 0,
      }))
      .sort((a: any, b: any) => b.avg_monthly_searches - a.avg_monthly_searches);

    const foundSet = new Set(results.map((r: any) => r.keyword?.toLowerCase()));
    const notFound = keywords.filter((k) => !foundSet.has(k.toLowerCase()));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              location: loc,
              total_checked: keywords.length,
              total_with_data: results.length,
              no_data_keywords: notFound,
              keywords: results,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool 4: List Available Locations ────────────────────────────────────────

server.tool(
  "list_locations",
  "List all available Philippine city/area location targets for keyword research.",
  {},
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            total: Object.keys(PH_CITY_GEO_TARGETS).length,
            locations: Object.entries(PH_CITY_GEO_TARGETS).map(([name, id]) => ({
              name,
              geo_target_id: id,
            })),
          },
          null,
          2
        ),
      },
    ],
  })
);

// ─── Start server ─────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
