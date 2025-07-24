
"use client";

import Link from "next/link";
import {
  Home,
  LogOut,
  Package,
  ScanLine,
  LineChart,
  DollarSign,
  Users,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRouter, usePathname } from "next/navigation";
import type { UserProfile } from "@/types";
import { cn } from "@/lib/utils";


const NavLink = ({ href, icon: Icon, label, isMobile = false, onClick }: { href: string; icon: React.ElementType; label: string; isMobile?: boolean; onClick?: () => void; }) => {
    const pathname = usePathname();
    const isActive = pathname.startsWith(href) && (href !== '/dashboard' || pathname === '/dashboard');

    if (isMobile) {
        return (
             <Link
                href={href}
                onClick={onClick}
                className={cn(
                    "flex items-center gap-4 px-2.5",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
            >
                <Icon className="h-5 w-5" />
                {label}
            </Link>
        )
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Link
                    href={href}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8 ${
                        isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Icon className="h-5 w-5" />
                    <span className="sr-only">{label}</span>
                </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
    );
};


const MobileLinks = ({ userProfile, onLinkClick }: { userProfile: UserProfile, onLinkClick: () => void }) => (
    <>
        <NavLink href="/dashboard" icon={Home} label="Dashboard" isMobile onClick={onLinkClick} />
        <NavLink href="/dashboard/products" icon={Package} label="Products" isMobile onClick={onLinkClick} />
        <NavLink href="/dashboard/billing" icon={ScanLine} label="Billing" isMobile onClick={onLinkClick} />
        <NavLink href="/dashboard/sales" icon={DollarSign} label="Sales" isMobile onClick={onLinkClick} />
        {userProfile.role === 'admin' && (
            <NavLink href="/dashboard/reports" icon={LineChart} label="Reports" isMobile onClick={onLinkClick} />
        )}
    </>
)


export function AppSidebar({ userProfile }: { userProfile: UserProfile }) {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <TooltipProvider>
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
        <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
          <Link
            href="/dashboard"
            className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
          >
            <Package className="h-4 w-4 transition-all group-hover:scale-110" />
            <span className="sr-only">ShopFlow</span>
          </Link>
          <NavLink href="/dashboard" icon={Home} label="Dashboard" />
          <NavLink href="/dashboard/products" icon={Package} label="Products" />
          <NavLink href="/dashboard/billing" icon={ScanLine} label="Billing" />
          <NavLink href="/dashboard/sales" icon={DollarSign} label="Sales" />
          {userProfile.role === 'admin' && (
            <NavLink href="/dashboard/reports" icon={LineChart} label="Reports" />
          )}
        </nav>
        <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
              >
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Logout</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Logout</TooltipContent>
          </Tooltip>
        </nav>
      </aside>
    </TooltipProvider>
  );
}

AppSidebar.MobileLinks = MobileLinks;
