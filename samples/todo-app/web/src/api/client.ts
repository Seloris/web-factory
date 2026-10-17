import createClient from "openapi-fetch";
import type { components, paths } from "./schema.d.ts";

// The only place that calls fetch; `/api` is proxied to the API by Vite in development.
export const api = createClient<paths>({ baseUrl: "/api" });

// RFC 9457 body the API sends on every error (`application/problem+json`).
export type ProblemDetails = components["schemas"]["ProblemDetails"];

// openapi-fetch leaves `error` empty when an error response has no body (the dev proxy's 502 when the API is down).
export function toProblem(error: unknown, response: Response): ProblemDetails {
  return typeof error === "object" && error !== null
    ? (error as ProblemDetails)
    : { type: "about:blank", title: response.statusText, status: response.status };
}
