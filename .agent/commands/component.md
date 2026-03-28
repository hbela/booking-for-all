
Create `.agent/commands/component.md`:

```markdown
# Generate shadcn/ui Component

Generate a new component using shadcn/ui:

1. Check if base component exists in shadcn/ui
2. If yes, use `npx shadcn@latest add $ARGUMENTS`
3. If custom component:
   - Create in `packages/ui/src/components/`
   - Export from `packages/ui/src/index.ts`
   - Use Tailwind v4 utilities
   - Use TypeScript with proper props typing
   - Add JSDoc comments

## Component Template
```tsx
import * as React from "react";
import { cn } from "../utils";

export interface ComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  // Add your props here
}

export const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("base-styles", className)}
        {...props}
      />
    );
  }
);

Component.displayName = "Component";