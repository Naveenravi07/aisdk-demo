import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/ratings')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/dashboard/posts"!</div>
}
