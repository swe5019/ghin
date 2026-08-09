import Link from "next/link";

const TABS = [
  { href: "/", label: "Draft Board" },
  { href: "/pairings", label: "Pairings" },
] as const;

export function NavTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav className="flex gap-1 border-b border-zinc-200 px-3 dark:border-zinc-800">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
            tab.href === active
              ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
