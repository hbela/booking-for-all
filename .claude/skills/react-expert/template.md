# Component Template — {{COMPONENT}}

## File
`apps/web/src/{{path}}/{{Component}}.tsx`

---

## Component

```typescript
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
// {{RADIX_IMPORTS}}
// e.g. import * as Dialog from '@radix-ui/react-dialog'

// ── Types ─────────────────────────────────────────────────────────────────────

interface {{Component}}Props {
  // {{PROPS}}
}

// ── Component ─────────────────────────────────────────────────────────────────

export function {{Component}}({ /* {{PROPS}} */ }: {{Component}}Props) {
  const { t } = useTranslation()

  // {{STATE}}
  // e.g. const [open, setOpen] = React.useState(false)

  // {{HOOKS}}
  // e.g. const { data, isLoading } = use{{Resource}}()
  // e.g. const mutation = useCreate{{Resource}}()

  // {{HANDLERS}}

  return (
    <div className="{{TAILWIND_CLASSES}}">
      {/* {{CONTENT}} */}
    </div>
  )
}
```

---

## Form variant (TanStack Form + Zod)

```typescript
import { useForm } from '@tanstack/react-form'
import { zodValidator } from '@tanstack/zod-form-adapter'
import { z } from 'zod'

const formSchema = z.object({
  // {{ZOD_FIELDS}}
})

export function {{Component}}Form({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation()
  const mutation = useCreate{{Resource}}()

  const form = useForm({
    defaultValues: {
      // {{DEFAULT_VALUES}}
    },
    validatorAdapter: zodValidator(),
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value)
      form.reset()
      onSuccess()
    },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      <form.Field name="{{field}}" validators={{ onChange: formSchema.shape.{{field}} }}>
        {(field) => (
          <div>
            <label htmlFor={field.name}>{t('{{i18n_key}}')}</label>
            <input
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors.map((err) => (
              <p key={err} className="text-red-500 text-sm">{err}</p>
            ))}
          </div>
        )}
      </form.Field>
      <button type="submit" disabled={form.state.isSubmitting}>
        {t('{{submit_key}}')}
      </button>
    </form>
  )
}
```

---

## Placeholders to replace

| Placeholder | Example |
|------------|---------|
| `{{Component}}` | `BookingCard` |
| `{{path}}` | `components` or `routes/provider` |
| `{{PROPS}}` | `booking: Booking; onCancel?: () => void` |
| `{{TAILWIND_CLASSES}}` | `flex flex-col gap-4 rounded-lg border p-4` |
| `{{RADIX_IMPORTS}}` | `import * as Dialog from '@radix-ui/react-dialog'` |
| `{{ZOD_FIELDS}}` | `startAt: z.string().datetime(), notes: z.string().optional()` |
| `{{i18n_key}}` | `bookings.form.startAt` |
| `{{submit_key}}` | `common.save` |
