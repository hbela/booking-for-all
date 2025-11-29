# Migration: Add Organization Timezone Support

This migration adds timezone and business hours fields to the `organization` table.

## Changes

- Added `timeZone` field (TEXT, default: 'Europe/Budapest')
- Added `availabilityStartHour` field (INTEGER, default: 8)
- Added `availabilityEndHour` field (INTEGER, default: 20)

## Purpose

Enables per-organization timezone configuration so that:
- Each organization can specify its own timezone (e.g., Europe/London, America/New_York)
- Business hours are validated in the organization's local timezone
- The app works correctly across different regions (UK, USA, Hungary, etc.)

## Notes

- Defaults are set to Hungary timezone (Europe/Budapest) for backward compatibility
- Existing organizations will use defaults until manually updated
- See `docs/TIMEZONE_MANAGEMENT.md` for usage details

