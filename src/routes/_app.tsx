import { Activity, Home, Link2, Settings } from "lucide-react"
import { createFileRoute, redirect, Outlet } from "@tanstack/react-router"

import { NavigationRail } from "@/components/navigation-rail"
import { getSession } from '@/lib/auth.functions'

export const Route = createFileRoute('/_app')({
    beforeLoad: async ({ location }) => {
        const session = await getSession();

        if (!session) {
            throw redirect({
                to: "/login",
                search: { redirect: location.href, error: undefined },
            });
        }

        return { user: session.user };
    },
    component: AppLayout,
})

function AppLayout() {
    return (
        <div className="flex min-h-screen bg-background">
            <NavigationRail
                items={[
                    { href: "/", icon: Home, label: "Home" },
                    { href: "/health", icon: Activity, label: "Health" },
                    { href: "/connections", icon: Link2, label: "Connections" },
                    { href: "/settings", icon: Settings, label: "Settings" },
                ]}
            />
            <main className="min-w-0 flex-1">
                <Outlet />
            </main>
        </div>
    )
}
