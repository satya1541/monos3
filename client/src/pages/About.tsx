import { Navigation } from "@/components/Navigation";
import { motion } from "framer-motion";
import portrait from "@/assets/portrait.png";

export default function About() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />

      <div className="container mx-auto px-4 h-full pt-24 md:pt-40 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 md:gap-24 items-start">

          {/* Image Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1 }}
            className="lg:col-span-5 lg:sticky lg:top-40 order-2 lg:order-1"
          >
            <div className="relative aspect-[3/4] overflow-hidden">
              <img
                src={portrait}
                alt="Photographer Portrait"
                className="w-full h-full object-cover grayscale contrast-125"
              />
              {/* Grain Overlay */}
              <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay bg-[url('https://upload.wikimedia.org/wikipedia/commons/7/76/Noise_pattern_with_intensity_0.3.png')]"></div>
            </div>
          </motion.div>

          {/* Text Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="lg:col-span-7 flex flex-col justify-center order-1 lg:order-2"
          >
            <h1 className="text-3xl md:text-5xl lg:text-7xl font-serif mb-8 leading-tight">
              A minimalist <span className="italic">file haven</span>.
            </h1>

            <div className="space-y-8 text-base md:text-xl text-muted-foreground font-light leading-relaxed">
              <p>
                Welcome to Game Space. We believe file sharing should be simple, boundless, and beautiful. No clutter, no ads, just your files and the people you share them with.
              </p>
              <p>
                Powered by high-speed cloud storage, we offer unlimited file sizes and lightning-fast direct downloads. Whether it's a game build, a 4K video, or a massive dataset, we handle it with ease.
              </p>
              <p>
                Experience the difference of a platform built for speed and aesthetics. Drag, drop, share. It's that simple.
              </p>
            </div>

            <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-8 border-t border-white/10 pt-12 pb-20">
              <div>
                <h3 className="uppercase tracking-widest text-xs mb-4 text-white">Features</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>Unlimited Upload Size</li>
                  <li>Direct S3 Downloads</li>
                  <li>24-Hour Link Expiry</li>
                </ul>
              </div>
              <div>
                <h3 className="uppercase tracking-widest text-xs mb-4 text-white">Support</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="hover:text-white transition-colors cursor-pointer break-all">support@gamespace.com</li>
                  <li className="hover:text-white transition-colors cursor-pointer">@gamespace_dev</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
