# notion-resonance-api (Netlify Functions, TypeScript)

This is the Express-based `notion-resonance-api` rewritten as a TypeScript
Netlify serverless function. It exposes the same data — a simplified list of
pages from a Notion database — without an always-on server.

## What changed from the JS Netlify version

- `netlify/functions/pages.js` → `netlify/functions/pages.ts`, typed against
  `@netlify/functions`'s `Handler`/`HandlerEvent` types and the Notion SDK's
  own response types.
- Notion's `databases.query()` results are typed as a union that includes
  partial page objects (for cases where a page isn't fully loaded). A type
  guard (`isFullPage`) filters to full `PageObjectResponse` objects before
  reading `.properties`, so property access is type-checked instead of
  relying on optional chaining and hoping for the best at runtime.
- `Name` and `Tags` property types are checked (`nameProp?.type === "title"`,
  etc.) before being read, matching how Notion's SDK discriminates property
  types. This avoids the kind of silent `undefined` bugs the original
  `// CHQ: unsure why the following lines did not work` comments in the
  Express version were probably running into — those were likely reading a
  property with the wrong assumed type.
- Netlify bundles and transpiles the function automatically via `esbuild`
  (configured in `netlify.toml`), so there's no manual `tsc` build step for
  deployment. `npm run typecheck` is available for local type-checking only.

## Project structure

\`\`\`
notion-resonance-api-netlify-ts/
├── netlify.toml
├── package.json
├── tsconfig.json
├── .env.example
└── netlify/
    └── functions/
        └── pages.ts
\`\`\`

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
2. Copy `.env.example` to `.env` and fill in your Notion credentials:
   \`\`\`bash
   cp .env.example .env
   \`\`\`
   - `NOTION_API_KEY`: your Notion integration's secret token.
   - `NOTION_API_DATABASE`: the ID of the database you want to query.

   Make sure your Notion integration has been shared/connected to that
   database, or the query will fail with a permissions error.

## Local development

Install the Netlify CLI if you don't have it:
\`\`\`bash
npm install -g netlify-cli
\`\`\`

Then run:
\`\`\`bash
npm run dev
\`\`\`

This starts a local server (default `http://localhost:8888`), transpiles
`pages.ts` on the fly, and reads variables from your `.env` file
automatically.

Test it with:
\`\`\`bash
curl http://localhost:8888/api/pages
\`\`\`

To type-check without running the server:
\`\`\`bash
npm run typecheck
\`\`\`

## Deploying

1. Push this project to a GitHub repo (or use `netlify deploy` directly from
   the CLI).
2. In the Netlify dashboard, create a new site from that repo — Netlify will
   auto-detect `netlify.toml`, the functions directory, and bundle the
   TypeScript function with esbuild at deploy time.
3. In **Site settings → Environment variables**, add `NOTION_API_KEY` and
   `NOTION_API_DATABASE` with the same values as your local `.env`.
4. Deploy. Your endpoint will be live at:
   \`\`\`
   https://<your-site-name>.netlify.app/api/pages
   \`\`\`

## Notes / things you may want to change

- CORS is currently wide open (`Access-Control-Allow-Origin: *`). If this
  API only ever serves one frontend, consider locking it to that origin in
  `netlify/functions/pages.ts`.
- This function queries Notion fresh on every request. If you start hitting
  Notion's rate limits under real traffic, look into Netlify's built-in
  cache headers (`Cache-Control` in the response) or a scheduled function
  that periodically syncs data into a small cache/store instead of querying
  live each time.
- If your Notion database's `Name`/`Tags` properties are ever renamed, the
  type guards will silently fall back to `undefined`/`[]` rather than throw.
  If you'd rather fail loudly on schema drift, add explicit error handling
  in `toSimplifiedPage`.
- The unused "create new page" logic from the original `api-module` was not
  ported over since it was commented out and unused. If you want a write
  endpoint (e.g. `POST /api/pages`), it can be added as a second `.ts`
  function following the same pattern.