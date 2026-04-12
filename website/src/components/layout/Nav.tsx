/// <reference lib="dom" />
import React, { useState, useEffect } from 'react';
import { motion, useScroll } from 'framer-motion';

const SECTIONS = [
  { id: 'features', label: 'FEATURES' },
  { id: 'install', label: 'DOWNLOAD' },
  { id: 'changelog', label: 'CHANGELOG' },
];

export const Nav = () => {
  const [activeSection, setActiveSection] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollYProgress } = useScroll();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };

  // Intersection observer for active section highlight
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry?.isIntersecting) setActiveSection(id);
        },
        { threshold: 0.3 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, []);

  // Close mobile menu on resize
  useEffect(() => {
    const handle = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-50 bg-[#000000] border-b border-[#222] h-16 flex items-center justify-between px-6 md:px-10">
        <motion.div 
          className="absolute bottom-[-1px] left-0 h-[1px] bg-[#00FF00] z-50"
          style={{ width: "100%", scaleX: scrollYProgress, transformOrigin: "0%" }}
        />
        
        {/* Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer shrink-0 group"
          onClick={() => scrollTo('hero')}
        >
          <div className="w-4 h-4 bg-[#00FF00] group-hover:scale-110 transition-transform" />
          <span className="font-mono font-bold tracking-widest text-white text-sm">
            [SYNCTAX]
          </span>
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-1">
          {SECTIONS.map(({ id, label }, i) => (
            <React.Fragment key={id}>
              {i > 0 && <span className="text-[#333] px-2 font-mono text-xs select-none">|</span>}
              <button
                onClick={() => scrollTo(id)}
                className={`group font-mono text-xs font-bold tracking-widest px-4 py-2 transition-colors duration-150 inline-flex items-center justify-center w-32 ${
                  activeSection === id ? 'text-[#00FF00]' : 'text-[#aaa] hover:text-[#00FF00] hover:bg-[#0a0a0a]'
                }`}
              >
                <span className={`opacity-0 -translate-x-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 ${activeSection === id ? 'opacity-100 translate-x-0' : ''}`}>[</span>
                <span className="mx-1">{label}</span>
                <span className={`opacity-0 translate-x-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 ${activeSection === id ? 'opacity-100 translate-x-0' : ''}`}>]</span>
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* CTA + Hamburger */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => scrollTo('install')}
            className="hidden md:flex bg-[#00FF00] text-black font-mono font-bold text-xs tracking-widest px-6 h-9 items-center hover:bg-white transition-colors duration-150 shadow-[2px_2px_0px_#222] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
          >
            INSTALL →
          </button>
          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col gap-[5px] p-2"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Toggle menu"
          >
            <span className={`block w-6 h-[2px] bg-white transition-transform duration-150 ${mobileOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
            <span className={`block w-6 h-[2px] bg-white transition-opacity duration-150 ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-[2px] bg-white transition-transform duration-150 ${mobileOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
          </button>
        </div>
      </nav>

      {/* Mobile Slide-in Menu */}
      <div
        className={`fixed inset-y-0 right-0 z-40 w-72 bg-[#000000] border-l border-[#222] transform transition-transform duration-200 linear flex flex-col pt-24 px-8 gap-2 ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => scrollTo(id)}
            className="font-mono text-[10px] font-bold tracking-widest text-left py-6 border-b border-[#111] text-[#aaa] hover:text-[#00FF00] transition-colors flex items-center gap-2 group"
          >
             <span className="text-transparent group-hover:text-[#00FF00] transition-colors">{'>'}</span> {label}
          </button>
        ))}
        <button
          onClick={() => scrollTo('install')}
          className="mt-8 bg-[#00FF00] text-black font-mono font-bold text-[10px] tracking-widest py-5 w-full hover:bg-white transition-colors border border-[#00FF00] shadow-[4px_4px_0_0_#222] active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          INSTALL →
        </button>
      </div>

      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
};
