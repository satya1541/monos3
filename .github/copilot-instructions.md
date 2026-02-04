# Copilot instructions for Mono S3

## Big picture architecture
- Full-stack app with Express + WebSocket server and a Vite/React client.
- Direct-to-S3 upload flow: client requests presigned URL, uploads to S3, then posts metadata to server.
- Server is the single entrypoint for API + client: `server/index.ts` mounts routes and Vite middleware in dev; production serves static build.
- Shared data model lives in `shared/schema.ts` (Drizzle tables + Zod insert schemas). Use this for both server validation and client typings.

## Key server flows and boundaries
- API routes live in `server/routes.ts`; upload endpoints are `/api/upload-url` and `/api/files` (metadata sync).
- Storage abstraction is `server/storage.ts` (Drizzle + grouping by `parentId` to show only latest version).
- WebSocket notifications are broadcast from `server/websocket.ts` and consumed by the client (see `client/src/pages/Games.tsx`).
- Auth is session-based via Passport Local (`server/auth.ts`); requests use cookies (`credentials: "include"`).
- S3 integration uses AWS SDK v3 in `server/s3.ts` (presigned PUT/GET + delete).

## Client patterns
- Routing uses Wouter with a `ProtectedRoute` wrapper (see `client/src/App.tsx`).
- React Query is configured in `client/src/lib/queryClient.ts`. Queries use `queryKey` as a URL array; mutations typically call `apiRequest()`.
- Auth state is managed in `client/src/lib/AuthProvider.tsx` (localStorage bootstrap + `/api/auth/me` session check).
- Real-time updates: WebSocket events update query cache in `client/src/pages/Games.tsx`.

## Dev workflows (from package.json/README)
- `npm run dev` starts the server with Vite middleware (single port from `PORT` env).
- `npm run dev:client` runs Vite standalone on port 5000.
- `npm run db:push` applies Drizzle schema changes to MySQL.
- `npm run build` and `npm start` build/run the production server.

## Conventions to keep
- Always validate request bodies with Zod schemas (`insertFileSchema`, `uploadUrlSchema`).
- Keep file privacy rules consistent (private/PIN files disallow previews and require PIN on downloads).
- When updating files, broadcast changes via WebSocket and update query cache on the client.
