# ADR-008: GraphQL Alongside REST

## Status
Accepted

## Date
2026-06-20

## Context
The AlharisTech platform serves two distinct API consumer profiles: (1) internal dashboards and reporting modules that require flexible, complex data aggregation across multiple domain entities, and (2) standard CRUD operations for day-to-day entity management (users, products, orders). A single API paradigm cannot optimally serve both. NestJS (ADR-002) provides first-class support for both REST (via `@nestjs/swagger`) and GraphQL (via `@nestjs/graphql`), and the API-First design mandate (ADR-014) requires us to define the API contract before implementation.

The platform's domain model is organized around bounded contexts per Domain-Driven Design (ADR-016), which naturally map to both REST resources and GraphQL domain types.

## Decision Drivers
1. Support complex, cross-entity queries for dashboards and reports without over-fetching or N+1 waterfall requests
2. Keep simple CRUD operations straightforward and tooling-friendly (cURL, SDK generation, API testing)
3. Leverage existing NestJS ecosystem and TypeScript (ADR-005) for schema validation
4. Maintain a single source of truth for input/output types shared between REST and GraphQL layers

## Options Considered

### Option A: NestJS code-first GraphQL + REST (dual-protocol)
- **Description:** Expose both a REST API (via `@nestjs/swagger` controllers) and a GraphQL API (via `@nestjs/graphql` code-first decorators) from the same NestJS modules. Shared DTOs and service layer serve both transports.
- **Pros:**
  - GraphQL handles complex dashboard/report queries with precise field selection and nested resolvers
  - REST remains available for simple CRUD, file uploads, webhooks, and third-party integrations
  - Code-first GraphQL auto-generates the schema from TypeScript classes — single source of truth
  - NestJS guards, interceptors, and pipes work identically across both transports
  - OpenAPI/Swagger spec (ADR-015) generated alongside GraphQL playground for dual documentation
- **Cons:**
  - Dual API surface to maintain, document, and test
  - Developers must understand both paradigms
  - Potential for behavioral divergence between REST and GraphQL endpoints
  - Resolver-layer boilerplate for every module that opts into GraphQL

### Option B: REST only
- **Description:** Use NestJS REST controllers exclusively for all API operations. Complex queries handled via dedicated aggregation endpoints or OData-style query parameters.
- **Pros:**
  - Single API surface — simpler to maintain, test, and secure
  - Every developer on the team already knows REST
  - Tooling ecosystem is mature and universal
- **Cons:**
  - Dashboard queries require orchestration endpoints or multiple round-trips — slow and brittle
  - Over-fetching and under-fetching are unavoidable without custom endpoints per view
  - Reporting flexibility is limited to what we hard-code in aggregation endpoints

### Option C: GraphQL only
- **Description:** Expose the entire API surface through a single GraphQL endpoint. All operations (queries + mutations) go through GraphQL.
- **Pros:**
  - Single endpoint, single schema, single source of truth
  - Flexible queries for every consumer without server changes
  - Strongly typed schema accessible via introspection
- **Cons:**
  - File uploads require spec extensions (GraphQL multipart request spec) — added complexity
  - Caching is significantly harder (POST-only, no HTTP cache semantics)
  - Rate limiting and authorization granularity are more complex
  - Third-party integrations (webhooks, automation tools) overwhelmingly expect REST
  - No native OpenAPI/Swagger support — undermines ADR-015

## Decision
We chose **Option A: NestJS code-first GraphQL + REST**. REST controllers handle all mutation operations (create, update, delete) and simple list endpoints. GraphQL resolvers handle complex read queries for dashboards, reports, and cross-domain data aggregation.

Rationale:
1. REST mutations keep CUD operations straightforward, tooling-friendly, and compatible with OpenAPI client generators (ADR-015)
2. GraphQL queries eliminate N+1 waterfall requests for dashboards — a single query fetches exactly what the UI needs
3. NestJS `@nestjs/graphql` code-first approach auto-generates the GraphQL schema from TypeScript decorators, ensuring DTOs (defined per ADR-005/ADR-014) serve as the single source of truth for both protocols
4. Apollo Federation compatibility is evaluated but deferred to Phase 5 — the initial deployment uses a monolithic GraphQL schema where `@nestjs/graphql` resolves from the same service layer
5. File uploads and webhook endpoints remain REST, avoiding GraphQL multipart spec complexity

## Consequences

### Positive
- Code-first GraphQL auto-generates schema from TypeScript — no manual `.graphql` schema maintenance, reducing drift between implementation and contract
- Shared DTO and service layer means business logic is written once and consumed by both REST controllers and GraphQL resolvers
- Dashboard and report consumers get exactly the data shape they need in one network round-trip
- REST endpoints remain the stable contract for external integrations, SDK generation, and CI contract testing
- NestJS guards (JWT from ADR-007) apply uniformly — authentication/authorization logic is not duplicated

### Negative
- Dual API surface increases the maintenance burden: each module must decide whether to expose REST, GraphQL, or both
- Testing effort doubles — API tests must cover both transports for the same business logic
- Developer onboarding requires familiarity with both REST and GraphQL patterns in NestJS
- Potential for inconsistent behavior if a resolver and controller inadvertently diverge from the shared service

### Risks
- **Risk 1: Resolver N+1 queries in GraphQL** — Mitigation: Use DataLoader (batching + caching) for all relations exposed through GraphQL. Enforce via ESLint rule that any `@ResolveField` returning an array must use DataLoader.
- **Risk 2: GraphQL query depth attacks** — Mitigation: Configure `graphql-query-complexity` or NestJS's built-in `maxDepth`/`complexity` options to limit deeply nested or expensive queries. Monitor with application performance monitoring (APM).
- **Risk 3: REST and GraphQL authorization drift** — Mitigation: All authorization logic lives in shared NestJS guards and policies. Both transports route through the same guard pipeline. Contract tests verify both surfaces enforce the same rules.
- **Risk 4: Apollo Federation migration cost** — Mitigation: Adopt a monolith GraphQL schema in Phase 1-4 using clean resolver boundaries. When migrating to Federation at Phase 5, each bounded context (DDD module) becomes a subgraph with minimal refactoring.

## Compliance
- Every module that adds a GraphQL resolver must add corresponding integration tests covering both REST and GraphQL entry points
- GraphQL schema generated by code-first approach is exported and checked into version control on each CI build
- Complexity limits (`maxDepth: 5`, `maxComplexity: 100`) enforced at the `GraphQLModule` configuration level
- GraphQL endpoints must pass the same OpenAPI-driven contract tests as REST where overlap exists

## Related Decisions
- [ADR-002: NestJS for Backend Services](./adr-002-nestjs-backend.md) — NestJS provides the foundation for both REST and GraphQL modules
- [ADR-005: TypeScript Across the Stack](./adr-005-typescript.md) — Shared TypeScript DTOs enable the code-first GraphQL approach
- [ADR-007: JWT with Refresh Tokens](./adr-007-jwt-refresh-tokens.md) — Authentication guards apply uniformly across REST and GraphQL
- [ADR-014: API First Design](./adr-014-api-first.md) — API contract defined before implementation, covering both REST (OpenAPI) and GraphQL (SDL)
- [ADR-015: OpenAPI/Swagger for API Documentation](./adr-015-openapi-swagger.md) — REST portion documented via OpenAPI; GraphQL introspection serves the same role
- [ADR-016: Domain-Driven Design](./adr-016-ddd.md) — Bounded contexts map naturally to GraphQL domain types and REST resource scopes

## References
- [NestJS GraphQL Code-First Documentation](https://docs.nestjs.com/graphql/quick-start#code-first)
- [Apollo Federation Specification](https://www.apollographql.com/docs/federation/)
- [GraphQL Query Complexity Analysis](https://github.com/slicknode/graphql-query-complexity)
