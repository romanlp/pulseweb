import type { LucideIcon } from "lucide-react"
import { HeartPulse } from "lucide-react"
import { useLocation } from "@tanstack/react-router"

import { cn } from "@/lib/utils"

export type NavigationRailItem = {
  label: string
  icon: LucideIcon
  href: string
}

type NavigationRailProps = {
  items: NavigationRailItem[]
  className?: string
  brandLabel?: string
}

/** Material 3 navigation rail for medium and expanded app layouts. */
function NavigationRail({
  brandLabel = "Pulseweb",
  className,
  items,
}: NavigationRailProps) {
  const { pathname } = useLocation()

  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        "hidden w-20 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar px-2 py-4 text-sidebar-foreground md:flex",
        className,
      )}
    >
      <a
        aria-label={brandLabel}
        className="mb-8 inline-flex size-12 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
        href="/"
      >
        <HeartPulse aria-hidden="true" className="size-6" />
      </a>

      <div className="flex w-full flex-1 flex-col items-center gap-3">
        {items.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <a
              aria-current={isActive ? "page" : undefined}
              className="group flex w-full flex-col items-center gap-1 text-center text-[0.6875rem] font-medium leading-4 outline-none"
              href={item.href}
              key={item.href}
            >
              <span
                className={cn(
                  "relative flex h-8 w-14 items-center justify-center rounded-full text-sidebar-foreground transition-colors group-hover:bg-sidebar-accent group-focus-visible:ring-2 group-focus-visible:ring-sidebar-ring",
                  isActive &&
                    "bg-sidebar-primary text-sidebar-primary-foreground group-hover:bg-sidebar-primary",
                )}
              >
                <Icon aria-hidden="true" className="size-6" strokeWidth={2} />
              </span>
              <span className="max-w-16 truncate">{item.label}</span>
            </a>
          )
        })}
      </div>
    </nav>
  )
}

export { NavigationRail }
