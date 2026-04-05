import React from 'react';
import { Nav } from './components/layout/Nav';
import { Hero } from './sections/Hero';
import { Features } from './sections/Features';
import { Install } from './sections/Install';
import { Changelog } from './sections/Changelog';
import { About } from './sections/About';
import { ScannerCardStream } from './components/ui/ScannerCardStream';

// ─── Personal card images for footer ─────────────────────────────────────────
// Replace these with your own photos or project images
const PERSONAL_IMAGES = [
  'assets/claude.png',
  'assets/cursor.png',
  'assets/antigravity.png',
  'assets/opencode.png',
  'assets/nanobanana.png',
  'assets/windsurf.png',
  'assets/zed.png',
  'assets/monolith.png',
];

function App() {
  return (
    <div className="bg-black min-h-screen text-white font-mono selection:bg-[#00FF00] selection:text-black">
      <Nav />
      <main>
        <Hero />
        <Features />
        <Install />
        <Changelog />
        <About />
      </main>

      {/* ─── Footer ─────────────────────────────────────────────── */}
      <footer className="bg-black border-t border-[#0a0a0a]">

        {/* Personal card section */}
        <div className="px-8 md:px-16 pt-24 pb-16 border-b border-[#0a0a0a]">
          <div className="max-w-6xl mx-auto">

            {/* Two-column: bio left, scanner right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start mb-16">

              {/* Left — personal bio card */}
              <div>
                <p className="font-mono text-[#00FF00] text-xs tracking-widest uppercase mb-8">
                  THE BUILDER // ABOUT ME
                </p>

                <h3 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tighter leading-none mb-8 text-white">
                  HI. I'M<br />
                  <span className="text-[#00FF00]">HD.</span>
                </h3>

                <p className="font-mono text-sm text-[#666] leading-relaxed mb-8 max-w-md">
                  I build developer tooling that solves real problems. Synctax
                  is the tool I needed but couldn't find — so I built it.
                  I care about craft, simplicity, and software that just works.
                </p>

                {/* Contact details */}
                <div className="flex flex-col gap-4 font-mono text-xs mb-10">
                  <div className="flex items-start gap-4">
                    <span className="text-[#333] w-24 shrink-0 uppercase tracking-widest">HANDLE</span>
                    <span className="text-[#aaa]">@kaos599</span>
                  </div>
                  <div className="flex items-start gap-4">
                    <span className="text-[#333] w-24 shrink-0 uppercase tracking-widest">ROLE</span>
                    <span className="text-[#aaa]">AI Engineer</span>
                  </div>
                  <div className="flex items-start gap-4">
                    <span className="text-[#333] w-24 shrink-0 uppercase tracking-widest">EMAIL</span>
                    <a
                      href="mailto:harshdayal13@gmail.com"
                      className="text-[#aaa] hover:text-[#00FF00] transition-colors relative group"
                    >
                      harshdayal13@gmail.com
                      <span className="absolute -bottom-px left-0 w-0 h-px bg-[#00FF00] transition-all duration-200 group-hover:w-full" />
                    </a>
                  </div>
                  <div className="flex items-start gap-4">
                    <span className="text-[#333] w-24 shrink-0 uppercase tracking-widest">GITHUB</span>
                    <a
                      href="https://github.com/kaos599"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#aaa] hover:text-[#00FF00] transition-colors relative group"
                    >
                      github.com/kaos599
                      <span className="absolute -bottom-px left-0 w-0 h-px bg-[#00FF00] transition-all duration-200 group-hover:w-full" />
                    </a>
                  </div>
                  <div className="flex items-start gap-4">
                    <span className="text-[#333] w-24 shrink-0 uppercase tracking-widest">TWITTER</span>
                    <a
                      href="https://twitter.com/woah_hd"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#aaa] hover:text-[#00FF00] transition-colors relative group"
                    >
                      @woah_hd
                      <span className="absolute -bottom-px left-0 w-0 h-px bg-[#00FF00] transition-all duration-200 group-hover:w-full" />
                    </a>
                  </div>
                </div>

                {/* CTA */}
                <a
                  href="https://github.com/kaos599/synctax"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 bg-[#00FF00] text-black font-mono font-bold text-xs tracking-widest px-8 py-4 hover:bg-white transition-colors duration-150"
                >
                  VIEW ON GITHUB →
                </a>
              </div>

              {/* Right — open source callout */}
              <div className="flex flex-col gap-8">
                <div className="border border-[#0a0a0a] bg-[#040404] p-10">
                  <div className="font-mono text-xs text-[#00FF00] mb-6 tracking-widest uppercase">
                    OPEN SOURCE // ALWAYS FREE
                  </div>
                  <p className="font-display text-2xl font-bold text-white uppercase tracking-tight leading-tight mb-6">
                    SYNCTAX IS FREE.<br />FOREVER. NO TRICKS.
                  </p>
                  <p className="font-mono text-xs text-[#555] leading-relaxed">
                    MIT License. No premium tiers. No usage limits. No phoning home.
                    Star it, fork it, break it, fix it — it's yours.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-px bg-[#0a0a0a]">
                  {[
                    { label: 'STARS', value: '2.1k' },
                    { label: 'FORKS', value: '148' },
                    { label: 'CONTRIBUTORS', value: '23' },
                    { label: 'LICENSE', value: 'MIT' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-black px-8 py-6 hover:bg-[#040404] transition-colors">
                      <div className="font-mono text-[9px] text-[#333] uppercase tracking-widest mb-2">{label}</div>
                      <div className="font-display text-2xl font-bold text-white">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Scanner Card Stream */}
            <div className="relative overflow-hidden border border-[#0a0a0a]">
              <div className="absolute top-0 left-0 right-0 z-30 px-4 py-2 bg-[#040404] border-b border-[#0a0a0a] flex items-center gap-3">
                <div className="w-2 h-2 bg-[#00FF00]" />
                <span className="font-mono text-[9px] text-[#444] uppercase tracking-widest">
                  SCANNER // DRAG TO EXPLORE
                </span>
              </div>
              <div className="pt-8">
                <ScannerCardStream
                  cardImages={PERSONAL_IMAGES}
                  repeat={4}
                  initialSpeed={60}
                  cardGap={40}
                />
              </div>
            </div>

          </div>
        </div>

        {/* Bottom strip */}
        <div className="px-8 md:px-16 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[#00FF00]" />
            <span className="font-mono text-xs text-[#444] tracking-widest">[SYNCTAX]</span>
          </div>
          <p className="font-mono text-xs text-[#333]">
            © 2026 Synctax. Free forever. MIT Licensed.
          </p>
          <p className="font-mono text-xs text-[#222] italic">
            Made with obsession.
          </p>
        </div>

      </footer>
    </div>
  );
}

export default App;
