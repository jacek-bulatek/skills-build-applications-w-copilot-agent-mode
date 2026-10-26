# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

- Presentation tier decision: Keep the React app thin and view-focused. The UI should render loading, empty, success, and error states from the shared API client and should not contain business logic or hard-coded data assumptions.
- Logic tier decision: Implement API behavior in Express routes and dedicated service functions, with explicit 4xx handling for invalid IDs, missing names, and unknown users. Validation errors should be deliberate, not cast errors leaking as 500 responses.
- Data tier decision: Enforce required schema fields in Mongoose models and keep the seed script idempotent via upserts. Stable seeded users, teams, and activities are foundational to the API and leaderboard contract.
- Activity tracking approach: Accept `userId`, `teamId`, `type`, and `minutes`, then resolve the user/team references and compute `points` and `occurredAt` before saving. Reject malformed IDs with a deliberate 4xx to avoid Mongo cast errors.
- Team management approach: Require a non-empty `name` and keep `mascot` plus `members` consistent with the seeded team records. Expose members in API responses so the frontend can render team membership without additional derivation.
- Leaderboard approach: Aggregate activity points by team, sort descending by total points, and assign 1-based ranking in the response. This keeps the endpoint deterministic and easy for the frontend to render.
- Workout suggestions approach: Match a user’s email to seeded data and derive recommendations from that user’s recent focus or goal, returning suggestions with a matching `focus`, a clear `reason`, and a recommended duration/difficulty that beats the default generic fallback.

## Test plan

Record the commands you run and what each failure means.

- Data-tier command: `npm run test:data --prefix octofit-tracker/backend`  
  Current result: 4 schema validation tests fail because required Mongoose fields are not enforced yet. This is the first layer to fix.
- API command: `npm run test:api --prefix octofit-tracker/backend`  
  Current result: invalid inputs return `501` instead of a deliberate `400`, the leaderboard is empty, and workout recommendations do not match seeded activity patterns. This confirms the route/service logic layer is still incomplete.
- Frontend command: `npm test --prefix octofit-tracker/frontend`  
  This is the correct project command; `--runInBand` is not supported by the Vitest version in this repo and should not be used. Frontend checks should be run after the backend contract is green.
- Backend build command: `npm run build --prefix octofit-tracker/backend`
- Frontend build command: `npm run build --prefix octofit-tracker/frontend`
