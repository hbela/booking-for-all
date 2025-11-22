# API Structure Analysis: Resource-Based vs Actor-Based Design

## Current Structure (Resource-Based - By "What")

The API is currently organized by **resource/domain** rather than **actor/role**:

```
/api/admin/*          → Requires ADMIN role ✅
/api/providers/*      → Requires OWNER role for mutations ❌ MISLEADING
/api/departments/*    → Requires OWNER role for mutations ❌ MISLEADING  
/api/events/*         → Requires PROVIDER role for mutations ✅ (mostly)
/api/bookings/*       → Requires authentication (CLIENT/PROVIDER) ❌ MIXED
/api/client/*         → Requires authentication (CLIENT) ✅
/api/organizations/*  → Public + authenticated ✅
```

## The Problem

### 1. `/api/providers/*` - Misleading Name
**Location:** `apps/server/src/features/providers/routes.ts`

| Endpoint | Method | Required Role | Actual Actor |
|----------|--------|---------------|--------------|
| `/api/providers` | GET | Any authenticated | Everyone (read) |
| `/api/providers/:id` | GET | Any authenticated | Everyone (read) |
| `/api/providers/create-user` | POST | **OWNER** | **Owner** (creates provider) |
| `/api/providers` | POST | **OWNER** | **Owner** (creates provider record) |
| `/api/providers/:id` | DELETE | **OWNER** | **Owner** (deletes provider) |

**Issue:** The name suggests these are routes **for providers**, but POST/DELETE operations are **for owners** managing providers.

### 2. `/api/departments/*` - Misleading Name
**Location:** `apps/server/src/features/departments/routes.ts`

| Endpoint | Method | Required Role | Actual Actor |
|----------|--------|---------------|--------------|
| `/api/departments` | GET | Any authenticated | Everyone (read) |
| `/api/departments` | POST | **OWNER** | **Owner** (creates department) |
| `/api/departments/:id` | DELETE | Any authenticated (checks OWNER in code) | **Owner** (deletes department) |

**Issue:** Similar to providers - mutations are **for owners**, not departments themselves.

### 3. `/api/events/*` - Partially Correct
**Location:** `apps/server/src/features/events/routes.ts`

| Endpoint | Method | Required Role | Actual Actor |
|----------|--------|---------------|--------------|
| `/api/events` | POST | **PROVIDER** | **Provider** (creates events) ✅ |
| `/api/events` | GET | Any authenticated | Everyone (read) |
| `/api/events/:id` | PUT | Any authenticated (checks provider ownership) | **Provider** (updates own events) |
| `/api/events/:id` | DELETE | Any authenticated (checks provider ownership) | **Provider** (deletes own events) |

**Issue:** GET is public, but mutations are **for providers**. This is actually correct behavior, but the structure doesn't make it obvious.

### 4. `/api/bookings/*` - Mixed Actors
**Location:** `apps/server/src/features/bookings/routes.ts`

| Endpoint | Method | Required Role | Actual Actor |
|----------|--------|---------------|--------------|
| `/api/bookings` | GET | Any authenticated | **CLIENT** (views own bookings) |
| `/api/bookings` | POST | Any authenticated | **CLIENT** (creates booking) |

**Issue:** Could be used by both CLIENT (book appointments) and PROVIDER (view bookings for their events). Structure doesn't clarify.

## Proposed Actor-Based Structure

Organize routes by **who** uses them, not **what** they manage:

```
/api/admin/*              → ADMIN role only
/api/owner/*              → OWNER role only
  ├─ /providers/*         → Manage providers (currently /api/providers)
  ├─ /departments/*       → Manage departments (currently /api/departments)
  ├─ /organizations/*     → Manage organization settings
  └─ /members/*           → Manage organization members
/api/provider/*           → PROVIDER role only
  ├─ /events/*            → Manage own events (currently /api/events)
  ├─ /availability/*      → Manage availability
  └─ /bookings/*          → View bookings for own events
/api/client/*             → CLIENT role (already exists)
  ├─ /bookings/*          → Manage own bookings
  ├─ /providers/*         → Browse providers (read-only)
  ├─ /events/*            → Browse available events (read-only)
  └─ /organizations/*     → View organizations (read-only)
/api/*                    → Public/shared endpoints
  ├─ /organizations/*     → Public organization info
  ├─ /providers/*         → Public provider listings
  └─ /events/*            → Public event listings
```

## Detailed Mapping

### Current → Proposed

#### Owner Routes (Currently Scattered)
```typescript
// CURRENT: /api/providers
POST   /api/providers/create-user      → POST   /api/owner/providers/create-user
POST   /api/providers                  → POST   /api/owner/providers
DELETE /api/providers/:id              → DELETE /api/owner/providers/:id

// CURRENT: /api/departments  
POST   /api/departments                → POST   /api/owner/departments
DELETE /api/departments/:id            → DELETE /api/owner/departments/:id

// KEEP READ ENDPOINTS SHARED:
GET    /api/providers                  → GET    /api/providers (public/shared)
GET    /api/providers/:id              → GET    /api/providers/:id (public/shared)
GET    /api/departments                → GET    /api/departments (public/shared)
```

#### Provider Routes (Currently in /api/events)
```typescript
// CURRENT: /api/events
POST   /api/events                     → POST   /api/provider/events
PUT    /api/events/:id                 → PUT    /api/provider/events/:id
DELETE /api/events/:id                 → DELETE /api/provider/events/:id

// KEEP READ ENDPOINTS SHARED:
GET    /api/events                     → GET    /api/events (public/shared)
GET    /api/events/:id                 → GET    /api/events/:id (public/shared)
```

#### Client Routes (Already Partially Correct)
```typescript
// CURRENT: /api/client (already exists)
GET    /api/client/bookings            → KEEP (already correct)
POST   /api/bookings                   → POST   /api/client/bookings (move from /api/bookings)

// CURRENT: /api/client (already exists)
GET    /api/client/providers/:id       → KEEP (already correct)
GET    /api/client/organizations       → KEEP (already correct)
```

## Benefits of Actor-Based Structure

1. **Clear Intent**: Route names immediately indicate which actor/role should use them
2. **Easier Authorization**: Route prefix naturally corresponds to required role
3. **Better Organization**: All routes for an actor are grouped together
4. **Reduced Confusion**: No more "provider routes for owners" confusion
5. **Easier Testing**: Test files can be organized by actor
6. **Better Documentation**: API docs can be organized by user persona

## Migration Strategy

1. **Phase 1: Add New Actor-Based Routes** (backward compatible)
   - Create `/api/owner/*` routes alongside existing routes
   - Create `/api/provider/*` routes alongside existing routes
   - Keep existing routes working

2. **Phase 2: Update Frontend** (gradual)
   - Update frontend to use new actor-based routes
   - Test thoroughly

3. **Phase 3: Deprecate Old Routes** (optional)
   - Mark old routes as deprecated
   - Add deprecation warnings
   - Eventually remove (if desired)

## Alternative: Hybrid Approach

Keep resource-based structure but add **clear actor-based prefixes** for mutations:

```typescript
// Owner mutations (clear actor prefix)
POST   /api/owner/providers/create-user
POST   /api/owner/providers
DELETE /api/owner/providers/:id

// Provider mutations (clear actor prefix)
POST   /api/provider/events
PUT    /api/provider/events/:id
DELETE /api/provider/events/:id

// Shared read endpoints (resource-based)
GET    /api/providers
GET    /api/providers/:id
GET    /api/events
GET    /api/events/:id
```

This hybrid approach:
- ✅ Keeps resource-based reads (clear what resource you're accessing)
- ✅ Uses actor-based mutations (clear who can perform the action)
- ✅ Minimal migration needed (mostly adding `/owner` and `/provider` prefixes)

## Recommendation

**Use the Hybrid Approach** because:
1. Read operations are naturally resource-based (you're fetching providers/events/departments)
2. Mutations are naturally actor-based (owners create providers, providers create events)
3. Minimal breaking changes
4. Clear separation of concerns
5. Easy to understand and maintain

## Implementation Example

```typescript
// apps/server/src/features/owner/routes.ts
const ownerRoutes: FastifyPluginAsync = async (app) => {
  // Manage providers
  app.post("/providers/create-user", { preValidation: [requireAuthHook, requireOwnerHook] }, ...);
  app.post("/providers", { preValidation: [requireAuthHook, requireOwnerHook] }, ...);
  app.delete("/providers/:id", { preValidation: [requireAuthHook, requireOwnerHook] }, ...);
  
  // Manage departments
  app.post("/departments", { preValidation: [requireAuthHook, requireOwnerHook] }, ...);
  app.delete("/departments/:id", { preValidation: [requireAuthHook, requireOwnerHook] }, ...);
};

// apps/server/src/features/provider/routes.ts
const providerRoutes: FastifyPluginAsync = async (app) => {
  // Manage own events
  app.post("/events", { preValidation: [requireAuthHook, requireProviderHook] }, ...);
  app.put("/events/:id", { preValidation: [requireAuthHook] }, ...); // checks ownership
  app.delete("/events/:id", { preValidation: [requireAuthHook] }, ...); // checks ownership
  
  // View own bookings
  app.get("/bookings", { preValidation: [requireAuthHook, requireProviderHook] }, ...);
};
```

