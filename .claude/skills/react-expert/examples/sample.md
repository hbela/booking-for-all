# Example — BookingCard component

A read-only card showing a booking with a cancel action, using Radix UI AlertDialog for confirmation, sonner for toasts, and i18n.

```typescript
// apps/web/src/components/BookingCard.tsx
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useCancelBooking } from '@/hooks/use-bookings'

interface Booking {
  id: string
  startAt: string
  endAt: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  provider: { user: { name: string } }
}

export function BookingCard({ booking }: { booking: Booking }) {
  const { t } = useTranslation()
  const cancel = useCancelBooking()

  const statusColor = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  }[booking.status]

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">{booking.provider.user.name}</span>
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusColor)}>
          {t(`bookings.status.${booking.status.toLowerCase()}`)}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        {new Date(booking.startAt).toLocaleString()} — {new Date(booking.endAt).toLocaleString()}
      </p>

      {booking.status !== 'CANCELLED' && (
        <AlertDialog.Root>
          <AlertDialog.Trigger asChild>
            <button className="mt-1 self-end text-sm text-red-600 hover:underline">
              {t('bookings.cancel')}
            </button>
          </AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 bg-black/40" />
            <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
              <AlertDialog.Title className="text-lg font-semibold">
                {t('bookings.cancelConfirm.title')}
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
                {t('bookings.cancelConfirm.description')}
              </AlertDialog.Description>
              <div className="mt-4 flex justify-end gap-2">
                <AlertDialog.Cancel asChild>
                  <button className="rounded px-4 py-2 text-sm">{t('common.cancel')}</button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <button
                    className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
                    onClick={() =>
                      cancel.mutate(booking.id, {
                        onError: (err) => toast.error(err.message),
                      })
                    }
                  >
                    {t('bookings.cancelConfirm.confirm')}
                  </button>
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      )}
    </div>
  )
}
```

## What makes this a good component

- Radix UI `AlertDialog` provides accessible confirmation without custom focus management
- `cn()` merges conditional Tailwind classes cleanly
- `useTranslation` for all user-visible strings — no hardcoded English
- `toast.error` from sonner for mutation failure feedback
- Status color map is exhaustive — TypeScript will error if a new status is added without updating the map
