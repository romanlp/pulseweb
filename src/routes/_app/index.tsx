import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/")({ component: Home });

function Home() {
    const { user } = Route.useRouteContext();

    return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Hello</h1>
        <div>Welcome, {user.name}!</div>
    </div>
  );
}
