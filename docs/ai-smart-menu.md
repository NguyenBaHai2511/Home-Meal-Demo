# Smart Menu: GPT-6 Luna

Smart Menu uses `POST /api?resource=smart-menu`. The browser sends meal preferences to the HomeMeal server; the server calls OpenAI Responses API using `gpt-6-luna` by default. Set the optional server-side `OPENAI_MODEL` to override it. This feature does not read or write PostgreSQL. Favorites stay in browser storage, and generated meals enter the existing meal planner draft; creating an order still requires the authenticated order API.

## Configure the API key

- Local: set `OPENAI_API_KEY` in the server `.env` file, never in a `VITE_*` variable. Start the API and frontend using the project scripts.
- Production: add `OPENAI_API_KEY` to the deployment platform's server environment variables and redeploy. The API key must have permission and quota for GPT-6 Luna.
- `OPENAI_MODEL` is optional and defaults to `gpt-6-luna`. Do not commit `.env` or paste secrets into source control/chat.

When the key is absent or is a placeholder, the API responds with `AI_NOT_CONFIGURED` and HTTP 503. Invalid/revoked keys or model access produce `AI_ACCESS_DENIED`; unavailable model produces `AI_MODEL_UNAVAILABLE`; quota exhaustion produces `AI_QUOTA_EXCEEDED`. The UI should preserve the explicit sample-menu fallback and must not label sample output as AI output.

## Data and order boundary

The server validates preferences and generated dishes, applies request limits, and omits height/weight from the provider request. Smart Menu is a suggestion tool, not medical advice. Adding a dish updates the existing planner draft only. A prior browser order snapshot is never imported into PostgreSQL: authenticated order reads come from PostgreSQL and writes go through the order API's authorization and validation.

## Focused checks

Run `npm test -- tests/smart-menu.test.ts tests/originPolicy.test.ts`, then `npm run lint` and `npm run build`. Provider tests should mock HTTP transport; they verify request shaping and error mapping, not real account access, quota, or model availability.
