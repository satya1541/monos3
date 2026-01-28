import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      <Navigation />

      <div className="relative h-screen w-full overflow-hidden">
        {/* Background Image with Parallax-like feel (static for now) */}
        <div
          className="absolute inset-0 bg-[url('@/assets/hero.png')] bg-cover bg-center bg-no-repeat opacity-60"
        />

        {/* Grain Overlay */}
        <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay bg-[url('https://upload.wikimedia.org/wikipedia/commons/7/76/Noise_pattern_with_intensity_0.3.png')]"></div>

        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="text-6xl md:text-9xl font-serif font-medium tracking-tighter mb-6"
          >
            MONO
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="text-sm md:text-base tracking-[0.2em] uppercase text-gray-300 mb-12 max-w-md leading-relaxed"
          >
            Capturing the silence between the noise
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.2 }}
          >
            <Link href="/games">
              <Button
                variant="outline"
                className="group border-white/20 hover:border-white hover:bg-white hover:text-black transition-all duration-500 rounded-none px-8 py-6 h-auto"
              >
                <span className="text-xs uppercase tracking-[0.3em] font-medium">Enter Games</span>
                <ArrowRight className="ml-3 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
