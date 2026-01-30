import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Menu, X, User, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navigation() {
  const [location, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout, isLoading } = useAuth();

  const links = [
    { href: "/", label: "Home" },
    { href: "/games", label: "Games" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/about", label: "About" },
  ];

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-6 py-6 md:px-12 md:py-8 mix-blend-difference text-white">
      <Link href="/">
        <span className="text-xl font-serif tracking-widest font-bold uppercase hover:opacity-70 transition-opacity z-[110] cursor-pointer">
          Mono.
        </span>
      </Link>

      {/* Desktop Links */}
      <div className="hidden md:flex items-center gap-8">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <span
              className={cn(
                "text-sm font-medium tracking-widest uppercase transition-all duration-300 hover:text-white/70 cursor-pointer",
                location === link.href ? "underline underline-offset-4 decoration-1" : ""
              )}
            >
              {link.label}
            </span>
          </Link>
        ))}

        {/* Auth Section */}
        {!isLoading && (
          <>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 text-sm font-medium tracking-widest uppercase hover:bg-transparent hover:text-white/70"
                  >
                    <User className="w-4 h-4 mr-2" />
                    {user.displayName || user.username}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-zinc-950 border-white/10 text-white">
                  <DropdownMenuItem className="text-xs uppercase tracking-widest opacity-50" disabled>
                    {user.role}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <span className="text-sm font-medium tracking-widest uppercase transition-all duration-300 hover:text-white/70 cursor-pointer">
                  Login
                </span>
              </Link>
            )}
          </>
        )}

      </div>

      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden z-[110] p-2 -mr-2"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-8 md:hidden mix-blend-normal"
          >
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                <span
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "text-3xl font-serif tracking-widest uppercase transition-all duration-300 cursor-pointer",
                    location === link.href ? "italic" : "opacity-50 hover:opacity-100"
                  )}
                >
                  {link.label}
                </span>
              </Link>
            ))}

            {/* Mobile Auth */}
            {!isLoading && (
              <>
                {user ? (
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsOpen(false);
                    }}
                    className="text-xl font-serif tracking-widest uppercase opacity-50 hover:opacity-100 flex items-center gap-2"
                  >
                    <LogOut className="w-5 h-5" />
                    Logout
                  </button>
                ) : (
                  <Link href="/login">
                    <span
                      onClick={() => setIsOpen(false)}
                      className="text-3xl font-serif tracking-widest uppercase opacity-50 hover:opacity-100 cursor-pointer"
                    >
                      Login
                    </span>
                  </Link>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
