---
trigger: always_on
---

# 🎨 Frontend Stack Standards (apps/web)

## Stack
- **TanStack Router** - File-based routing
- **TanStack Query** - Server state management
- **TanStack Form** - Form handling with Zod validation
- **shadcn/ui** - Component library
- **Tailwind CSS v4** - Styling

---

## 📁 File Structure

apps/web/
├── src/
│ ├── routes/ # TanStack Router file-based routes
│ ├── components/ # React components
│ │ ├── ui/ # shadcn/ui components
│ │ └── features/ # Feature-specific components
│ ├── lib/ # Utilities
│ │ ├── queries/ # TanStack Query options
│ │ └── utils.ts # cn(), etc.
│ ├── hooks/ # Custom React hooks
│ └── types/ # Local types (use shared when possible)

text

---
## 🧭 TanStack Router Patterns

### Route Definition
```tsx
// ✅ CORRECT - File-based routing with loaders
// src/routes/posts/$postId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { postQueryOptions } from '@/lib/queries/posts'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params, context: { queryClient } }) => {
    return await queryClient.ensureQueryData(postQueryOptions(params.postId))
  },
  component: PostDetail,
  pendingComponent: PostSkeleton,
  errorComponent: PostError,
})

function PostDetail() {
  const { postId } = Route.useParams()
  const { data } = useSuspenseQuery(postQueryOptions(postId))
  return <PostDetailView post={data} />
}
Navigation
tsx
// ✅ CORRECT - Use TanStack Router hooks
import { useNavigate, Link } from '@tanstack/react-router'

function Header() {
  const navigate = useNavigate()
  
  return (
    <Link to="/posts/$postId" params={{ postId: '123' }}>
      View Post
    </Link>
  )
}

// ❌ WRONG - Don't use window.location
// window.location.href = '/posts/123'
📊 TanStack Query Patterns
Query Options (Centralized)
tsx
// ✅ CORRECT - Centralized query options
// src/lib/queries/posts.ts
import { queryOptions } from '@tanstack/react-query'

export const postsQueryOptions = queryOptions({
  queryKey: ['posts'],
  queryFn: () => fetch('/api/posts').then(res => res.json()),
  staleTime: 1000 * 60 * 5, // 5 minutes
})

export const postQueryOptions = (id: string) => queryOptions({
  queryKey: ['posts', id],
  queryFn: () => fetch(`/api/posts/${id}`).then(res => res.json()),
  staleTime: 1000 * 60 * 5,
})
Mutations
tsx
// ✅ CORRECT - Mutations with cache updates
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useCreatePost() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: CreatePostInput) => 
      fetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}

// ❌ WRONG - Don't fetch directly in components
// useEffect(() => { fetch('/api/posts') }, [])
📝 TanStack Form Patterns
Form with Zod Validation
tsx
// ✅ CORRECT - Use TanStack Form with Zod
import { useForm } from '@tanstack/react-form'
import { zodValidator } from '@tanstack/zod-form-adapter'
import { z } from 'zod'

const postSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
})

export function CreatePostForm() {
  const createPost = useCreatePost()
  
  const form = useForm({
    defaultValues: { title: '', content: '' },
    validatorAdapter: zodValidator(),
    validators: { onChange: postSchema },
    onSubmit: async ({ value }) => {
      await createPost.mutateAsync(value)
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="space-y-4"
    >
      <form.Field
        name="title"
        children={(field) => (
          <div>
            <label className="text-sm font-medium">Title</label>
            <input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            />
            {field.state.meta.errors && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors.join(', ')}
              </p>
            )}
          </div>
        )}
      />
      
      <form.Field
        name="content"
        children={(field) => (
          <div>
            <label className="text-sm font-medium">Content</label>
            <textarea
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            />
            {field.state.meta.errors && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors.join(', ')}
              </p>
            )}
          </div>
        )}
      />
      
      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
        children={([canSubmit, isSubmitting]) => (
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Post'}
          </button>
        )}
      />
    </form>
  )
}

// ❌ WRONG - Don't use react-hook-form in this project
// import { useForm } from 'react-hook-form'
🎨 shadcn/ui + Tailwind v4
Component Pattern
tsx
// ✅ CORRECT - shadcn/ui pattern with forwardRef
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline'
  size?: 'default' | 'sm' | 'lg'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
          variant === 'default' && 'bg-primary text-primary-foreground hover:bg-primary/90',
          variant === 'destructive' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
          variant === 'outline' && 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
          size === 'default' && 'h-10 px-4 py-2',
          size === 'sm' && 'h-8 rounded-md px-3 text-sm',
          size === 'lg' && 'h-12 rounded-md px-6 text-lg',
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
Tailwind v4 Theme Usage
tsx
// ✅ CORRECT - Use theme variables
<div className="bg-background text-foreground">
  <h1 className="text-primary">Title</h1>
  <p className="text-muted-foreground">Description</p>
</div>

// ❌ WRONG - Hardcoded colors
// <div className="bg-white text-black">
// <h1 className="text-blue-500">
🪝 Custom Hooks
tsx
// ✅ CORRECT - Encapsulate logic in hooks
// src/hooks/useDebounce.ts
import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  
  return debouncedValue
}

// ✅ CORRECT - Combine with TanStack
// src/hooks/useSearchPosts.ts
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from './useDebounce'

export function useSearchPosts(query: string) {
  const debouncedQuery = useDebounce(query, 300)
  
  return useQuery({
    queryKey: ['posts', 'search', debouncedQuery],
    queryFn: () => fetch(`/api/posts/search?q=${debouncedQuery}`).then(res => res.json()),
    enabled: debouncedQuery.length >= 2,
  })
}
🚫 Frontend Prohibitions
❌ Don't Use	✅ Use Instead
react-hook-form	@tanstack/react-form
react-router-dom	@tanstack/react-router
useEffect for data fetching	useSuspenseQuery or useQuery
useState for server data	useQuery with query options
Manual cache management	queryClient.invalidateQueries
window.location navigation	useNavigate() from TanStack Router
Hardcoded colors	Theme CSS variables
Custom CSS files	Tailwind utilities
Class components	Functional components with hooks

