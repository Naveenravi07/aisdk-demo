import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/')({
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
      <h2 className="text-2xl font-semibold mb-4">Welcome</h2>
      <p className="text-muted-foreground">Welcome to your dashboard. Select a feature from the navigation to get started.</p>
    </div>
  );
}
