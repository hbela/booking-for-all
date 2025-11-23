# Timezone Management Guide

This document explains how timezone management works in the Booking for All application, allowing it to work correctly across different regions (UK, USA, Hungary, etc.).

## Overview

The application now supports **per-organization timezone configuration**. Each organization can specify its own:
- **Timezone** (IANA timezone identifier, e.g., `Europe/London`, `America/New_York`)
- **Business hours** (start and end hours for availability)

This ensures that:
- Providers in the UK work with UK time (`Europe/London`)
- Providers in the USA work with their local time (e.g., `America/New_York` for EST, `America/Los_Angeles` for PST)
- Providers in Hungary work with Hungarian time (`Europe/Budapest`)
- Business hours are validated in the organization's local timezone

## Architecture

### Database Schema

Timezone and business hours are stored at the **Organization level** in the `Organization` model:

```prisma
model Organization {
  // ... existing fields ...
  timeZone             String  @default("Europe/Budapest") // IANA timezone
  availabilityStartHour Int     @default(8)  // Business hours start (0-23)
  availabilityEndHour   Int     @default(20) // Business hours end (0-23)
}
```

**Rationale**: Organizations are regional entities. All providers in the same organization share the same timezone and business hours.

### Data Flow

1. **Provider** → **Department** → **Organization**
   - Providers belong to departments
   - Departments belong to organizations
   - Event validation uses the organization's timezone

2. **Event Creation Flow**:
   ```
   POST /api/provider/events
   ↓
   Fetch provider with department and organization
   ↓
   Get organization's timeZone, availabilityStartHour, availabilityEndHour
   ↓
   Convert event start/end times to organization's timezone
   ↓
   Validate business hours in organization's timezone
   ↓
   Store event times (always in UTC in database)
   ```

### How It Works

1. **Input**: Event times are sent as ISO 8601 strings (e.g., `2025-01-22T14:00:00+01:00` or `2025-01-22T14:00:00Z`)

2. **Validation**: 
   - Times are converted to the organization's timezone using `Intl.DateTimeFormat`
   - Business hours are checked in the organization's local time
   - Example: A 9 AM event in UK timezone (`Europe/London`) will be validated as 9 AM UK time, not 9 AM UTC

3. **Storage**: 
   - All event times are stored in **UTC** in the database (standard practice)
   - When retrieved, they can be converted back to the organization's timezone for display

4. **Fallback**: 
   - If organization doesn't have timezone set, defaults are used:
     - `timeZone`: `"Europe/Budapest"` (or `AVAILABILITY_TIME_ZONE` env var)
     - `availabilityStartHour`: `8` (or `AVAILABILITY_START_HOUR` env var)
     - `availabilityEndHour`: `20` (or `AVAILABILITY_END_HOUR` env var)

## Setup Instructions

### Step 1: Run Database Migration

After updating the Prisma schema, create and run a migration:

```bash
# Generate Prisma migration
npx prisma migrate dev --name add_organization_timezone

# This will:
# 1. Update the database schema
# 2. Regenerate Prisma Client with new types
```

### Step 2: Update Existing Organizations

For existing organizations, you can set their timezone via database update or admin API:

**Via SQL**:
```sql
-- UK organization
UPDATE organization 
SET "timeZone" = 'Europe/London', 
    "availabilityStartHour" = 9, 
    "availabilityEndHour" = 17 
WHERE slug = 'uk-clinic';

-- USA organization (Eastern Time)
UPDATE organization 
SET "timeZone" = 'America/New_York', 
    "availabilityStartHour" = 8, 
    "availabilityEndHour" = 18 
WHERE slug = 'us-clinic';

-- Hungarian organization (default)
UPDATE organization 
SET "timeZone" = 'Europe/Budapest', 
    "availabilityStartHour" = 8, 
    "availabilityEndHour" = 20 
WHERE slug = 'hungarian-clinic';
```

**Via Admin API** (if you add update endpoint):
```typescript
// PATCH /api/admin/organizations/:id
{
  "timeZone": "Europe/London",
  "availabilityStartHour": 9,
  "availabilityEndHour": 17
}
```

### Step 3: Environment Variables (Optional)

Environment variables still work as **fallbacks** only:

```env
# Fallback defaults (used if organization doesn't have timezone set)
AVAILABILITY_TIME_ZONE=Europe/Budapest
AVAILABILITY_START_HOUR=8
AVAILABILITY_END_HOUR=20
```

These are only used if:
- Organization doesn't have `timeZone` set in database
- Provider doesn't have an organization (edge case)

## Examples

### Example 1: UK Organization

**Organization Setup**:
```typescript
{
  name: "London Medical Clinic",
  slug: "london-clinic",
  timeZone: "Europe/London",
  availabilityStartHour: 9,  // 9 AM GMT/BST
  availabilityEndHour: 17     // 5 PM GMT/BST
}
```

**Event Creation**:
```json
POST /api/provider/events
{
  "providerId": "...",
  "title": "Morning Consultation",
  "start": "2025-01-23T09:00:00Z",  // 9 AM UTC (10 AM BST in summer, 9 AM GMT in winter)
  "end": "2025-01-23T10:00:00Z"
}
```

**Validation**:
- Start time: `09:00 UTC` → converted to `09:00` or `10:00` in London timezone (depending on DST)
- Validates against business hours: `09:00` (start) to `17:00` (end) in London timezone
- ✅ Valid if within 9 AM - 5 PM London time

### Example 2: USA Organization (Eastern Time)

**Organization Setup**:
```typescript
{
  name: "New York Medical Center",
  slug: "ny-medical",
  timeZone: "America/New_York",
  availabilityStartHour: 8,  // 8 AM EST/EDT
  availabilityEndHour: 18     // 6 PM EST/EDT
}
```

**Event Creation**:
```json
POST /api/provider/events
{
  "providerId": "...",
  "title": "Afternoon Session",
  "start": "2025-01-23T18:00:00Z",  // 6 PM UTC (1 PM EST / 2 PM EDT)
  "end": "2025-01-23T19:00:00Z"
}
```

**Validation**:
- Start time: `18:00 UTC` → converted to `13:00` or `14:00` in New York timezone (depending on DST)
- Validates against business hours: `08:00` (start) to `18:00` (end) in New York timezone
- ✅ Valid if within 8 AM - 6 PM New York time

### Example 3: Hungarian Organization

**Organization Setup**:
```typescript
{
  name: "Budapest Clinic",
  slug: "budapest-clinic",
  timeZone: "Europe/Budapest",  // GMT+1 (CET) / GMT+2 (CEST)
  availabilityStartHour: 8,
  availabilityEndHour: 20
}
```

This is the default configuration for Hungarian organizations.

## IANA Timezone Identifiers

Common timezones you might need:

| Region | IANA Identifier | Notes |
|--------|----------------|-------|
| United Kingdom | `Europe/London` | GMT/BST (GMT+0/GMT+1) |
| USA - Eastern | `America/New_York` | EST/EDT (GMT-5/GMT-4) |
| USA - Central | `America/Chicago` | CST/CDT (GMT-6/GMT-5) |
| USA - Mountain | `America/Denver` | MST/MDT (GMT-7/GMT-6) |
| USA - Pacific | `America/Los_Angeles` | PST/PDT (GMT-8/GMT-7) |
| Hungary | `Europe/Budapest` | CET/CEST (GMT+1/GMT+2) |
| Germany | `Europe/Berlin` | CET/CEST (GMT+1/GMT+2) |
| France | `Europe/Paris` | CET/CEST (GMT+1/GMT+2) |
| Japan | `Asia/Tokyo` | JST (GMT+9) |

**Full list**: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

## Best Practices

1. **Always use IANA timezone identifiers** (e.g., `Europe/London`, not `GMT` or `UTC+1`)
   - IANA identifiers handle DST automatically
   - They're unambiguous and internationally recognized

2. **Store times in UTC in the database**
   - This is standard practice
   - Prevents issues with DST transitions
   - Event times in the database are timezone-agnostic

3. **Convert to organization timezone only for validation**
   - Validate business hours in the organization's local time
   - Display times in the organization's local time for users

4. **Handle DST transitions**
   - IANA timezone identifiers automatically handle DST
   - `Intl.DateTimeFormat` correctly converts times considering DST

5. **Set timezone at organization creation**
   - When creating an organization via admin API, include timezone
   - Update existing organizations to set their timezone

## Troubleshooting

### Issue: Times seem wrong

**Check**:
1. Is the organization's timezone set correctly?
2. Are event times being sent in the correct format (ISO 8601)?
3. Is DST being handled correctly? (should be automatic with IANA identifiers)

### Issue: Validation fails unexpectedly

**Check**:
1. What timezone is the organization using?
2. What timezone are the event times in when sent?
3. Convert the event time to the organization's timezone manually to verify

### Issue: TypeScript errors about timeZone property

**Solution**: Run Prisma migration and regenerate client:
```bash
npx prisma migrate dev
npx prisma generate
```

## Future Enhancements

Potential improvements:
1. **Per-provider timezone override**: Allow providers to have different timezone than organization (if needed)
2. **Timezone-aware event display**: Convert event times to user's local timezone for display
3. **Business hours per day**: Support different hours for weekdays vs weekends
4. **Timezone selection UI**: Allow organization owners to select timezone in admin panel

