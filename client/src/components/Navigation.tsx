import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function Navigation() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { href: "/", label: "Home" },
    { href: "/games", label: "Games" },
    { href: "/about", label: "About" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-6 py-6 md:px-12 md:py-8 mix-blend-difference text-white">
      <Link href="/">
        <a className="text-xl font-serif tracking-widest font-bold uppercase hover:opacity-70 transition-opacity z-[110]">
          Mono.
        </a>
      </Link>

      {/* Desktop Links */}
      <div className="hidden md:flex gap-8">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <a
              className={cn(
                "text-sm font-medium tracking-widest uppercase transition-all duration-300 hover:text-white/70",
                location === link.href ? "underline underline-offset-4 decoration-1" : ""
              )}
            >
              {link.label}
            </a>
          </Link>
        ))}
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
                <a
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "text-3xl font-serif tracking-widest uppercase transition-all duration-300",
                    location === link.href ? "italic" : "opacity-50 hover:opacity-100"
                  )}
                >
                  {link.label}
                </a>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
