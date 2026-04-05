import React, { useRef, useState, useEffect } from 'react';
import { FeatureCard } from '../components/ui/FeatureCard';

const FEATURES = [
  {
    id: "01",
    title: "THE MASTER CONFIG",
    description: "One single `~/.synctax/config.json` that governs your entire AI toolchain.",
    details: "No more copying MCP servers across editors. Define agents and endpoints once. Synctax automatically translates your master schema to Claude Code, Cursor, OpenCode, and Zed specific formats."
  },
  {
    id: "02",
    title: "UNIVERSAL SYNC",
    description: "Push changes to up to 8 different AI tools simultaneously with one command.",
    details: "Run `synctax sync` to reliably deploy massive config updates. Features atomic file-writes and automatic pre-sync snapshots — if any client update fails, the entire transaction rolls back cleanly."
  },
  {
    id: "03",
    title: "CONTEXT PROFILES",
    description: "Distinct setups for work, freelance, and personal projects. Switch instantly.",
    details: "Create profiles to filter active MCPs and agents. Command `synctax profile use work` instantly swaps your entire local toolchain to enterprise mode. Plus, you can share profiles securely via URL."
  },
  {
    id: "04",
    title: "BACKGROUND WATCHER",
    description: "A hyper-fast daemon that keeps every editor synchronized while you work.",
    details: "Type `synctax watch` to launch a headless 5MB RAM background service. Edit your master config normally—the daemon detects changes with a 500ms debounce and instantly propagates them to all clients."
  },
  {
    id: "05",
    title: "TERMINAL DASHBOARD",
    description: "A full fullscreen interactive TUI to monitor and diagnose your AI infrastructure.",
    details: "Launch the `synctax` dashboard wrapper to check system health, track config drift, and detect broken MCP paths using deep validation. Includes a command palette and 16 built-in brutalist themes."
  },
  {
    id: "06",
    title: "HARDENED SECURITY",
    description: "Deny-wins merging logic and secure environment variable resolution.",
    details: "Protects against over-permissioning during profile syncs using strict deny-wins rules. API keys stay isolated in `.env` files and are resolved only at sync time. Never pushed to external URLs during exports."
  },
];

export const Features = () => {
  const scrollContainer = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const el = scrollContainer.current;
      if (!el) return;
      const cardWidth = el.querySelector<HTMLElement>('.snap-center')?.offsetWidth ?? 460;
      if (e.key === 'ArrowRight') {
        el.scrollBy({ left: cardWidth + 32, behavior: 'smooth' });
      } else if (e.key === 'ArrowLeft') {
        el.scrollBy({ left: -(cardWidth + 32), behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Dot pagination scroll tracking
  useEffect(() => {
    const el = scrollContainer.current;
    if (!el) return;
    const handleScroll = () => {
      const cardWidth = el.querySelector<HTMLElement>('.snap-center')?.offsetWidth ?? 460;
      const index = Math.round(el.scrollLeft / (cardWidth + 32));
      setActiveIndex(Math.min(index, FEATURES.length - 1));
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToCard = (i: number) => {
    const el = scrollContainer.current;
    if (!el) return;
    const cardWidth = el.querySelector<HTMLElement>('.snap-center')?.offsetWidth ?? 460;
    el.scrollTo({ left: i * (cardWidth + 32), behavior: 'smooth' });
  };

  return (
    <section id="features" className="min-h-screen bg-black pt-32 pb-24 relative overflow-hidden flex flex-col justify-center">

      {/* Section Header */}
      <div className="w-full border-b border-[#1a1a1a] mb-16">
        <div className="max-w-6xl mx-auto w-full px-8 md:px-16 pb-16">
          <p className="font-mono text-[#00FF00] text-xs tracking-widest uppercase mb-6">
            SEC // FEATURES
          </p>
          <h2 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold uppercase tracking-tighter text-white leading-none">
            SIX REASONS<br />
            <span className="text-[#00FF00]">DEVELOPERS</span><br />
            LOVE IT.
          </h2>
          <p className="font-mono text-[#555] mt-6 text-sm max-w-md leading-relaxed uppercase tracking-wide">
            Every config. Every tool.<br />One place. No drama.
          </p>
        </div>
      </div>

      {/* Horizontal Scroll Strip */}
      <div
        ref={scrollContainer}
        className="flex gap-8 overflow-x-auto pb-12 snap-x snap-mandatory scrollbar-hide before:shrink-0 before:w-0 md:before:w-[calc((100vw-72rem)/2)] after:shrink-0 after:w-0 md:after:w-[calc((100vw-72rem)/2)] px-8 md:px-16"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {FEATURES.map((feat) => (
          <div key={feat.id} className="snap-center shrink-0">
            <FeatureCard {...feat} />
          </div>
        ))}
      </div>

      {/* Dot Pagination */}
      <div className="max-w-6xl mx-auto w-full px-8 md:px-16 flex items-center gap-4 mt-4">
        {FEATURES.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToCard(i)}
            className={`transition-all duration-150 ${
              activeIndex === i
                ? 'w-8 h-2 bg-[#00FF00]'
                : 'w-2 h-2 bg-[#333] hover:bg-[#555]'
            }`}
            aria-label={`Go to feature ${i + 1}`}
          />
        ))}
        <span className="font-mono text-xs text-[#333] ml-4 uppercase tracking-widest">
          {String(activeIndex + 1).padStart(2, '0')} / {String(FEATURES.length).padStart(2, '0')}
        </span>
      </div>

    </section>
  );
};
