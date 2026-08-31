import type { Handler, HandlerEvent } from "@netlify/functions";
import { Client } from "@notionhq/client";
import type {
  QueryDatabaseResponse,
  PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_API_DATABASE as string;

// Shared CORS headers. Adjust the origin if you want to lock this down
// to a specific frontend instead of allowing any origin.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Content-Type-Options, Accept, X-Requested-With, Origin",
};

// Shape returned to the client, matching the original Express API.
interface SimplifiedPage {
  id: string;
  name: string | undefined;
  tags: string[];
}

// Type guard: Notion's SDK types `results` as a union that includes
// partial/unresolved page objects. We only want full page objects,
// since those are the ones with a usable `properties` field.
function isFullPage(
  page: QueryDatabaseResponse["results"][number]
): page is PageObjectResponse {
  return "properties" in page;
}

function toSimplifiedPage(page: PageObjectResponse): SimplifiedPage {
  const nameProp = page.properties.Name;
  const tagsProp = page.properties.Tags;

  const name =
    nameProp?.type === "title" ? nameProp.title[0]?.plain_text : undefined;

  const tags =
    tagsProp?.type === "multi_select"
      ? tagsProp.multi_select.map((tag: { name: string }) => tag.name)
      : [];

  return { id: page.id, name, tags };
}

export const handler: Handler = async (event: HandlerEvent) => {
  // Handle CORS preflight requests
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const response = await notion.databases.query({
      database_id: databaseId,
    });

    const pages: SimplifiedPage[] = response.results
      .filter(isFullPage)
      .map(toSimplifiedPage);

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pages),
    };
  } catch (err) {
    console.error("Error querying Notion database:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Failed to fetch Notion database" }),
    };
  }
};