import React from 'react';
import { DitheringShader } from '../components/ui/dithering-shader';
import { Terminal } from 'lucide-react';

export const Hero = () => {
  return (
    <section id="hero" className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden border-b border-[#333]">
        {/* Background Wave */}
        <div className="absolute inset-0 z-0 opacity-40">
            <DitheringShader shape="wave" colorFront="#005500" colorBack="#000000" type="8x8" />
        </div>
        
        {/* Giant Typography */}
        <div className="relative z-10 flex flex-col items-center pointer-events-none mt-16 mix-blend-difference w-full">
            <div className="max-w-6xl mx-auto w-full px-8 md:px-16 flex flex-col items-center">
                <h1 className="text-[18vw] leading-none font-bold font-display uppercase tracking-tighter text-white">
                    SYNCTAX
                </h1>
                <p className="font-mono text-sm md:text-lg bg-white text-black px-6 py-2 mt-4 font-bold border border-black shadow-[4px_4px_0_0_#00FF00]">
                    One config file. Every AI tool in sync. Always.
                </p>
            </div>
        </div>

        {/* Floating Actions */}
        <div className="relative z-20 mt-16 flex flex-col md:flex-row gap-6">
            <button 
                onClick={() => document.getElementById('install')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-[#00FF00] text-black px-8 py-4 font-bold font-mono tracking-widest hover:bg-white transition-colors flex items-center gap-3 border border-[#00FF00]"
            >
                <span>INSTALL</span>
                <Terminal size={18} />
            </button>
            <a 
                href="https://github.com/kaos599/Synctax"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-transparent text-white px-8 py-4 font-bold font-mono tracking-widest hover:bg-[#333] transition-colors border border-white/30 flex items-center gap-3"
            >
                <span className="text-[#888]">{'>'}</span> VIEW DOCS
            </a>
        </div>

        {/* Bottom Scrolling Marquee */}
        <div className="absolute bottom-0 left-0 w-full h-12 bg-black border-t border-[#333] overflow-hidden flex items-center z-20">
            <div className="font-mono text-[10px] md:text-xs text-[#00FF00] tracking-widest uppercase whitespace-nowrap animate-marquee flex gap-12">
                <span>{'>'} configs stay in sync</span>
                <span>{'>'} works with 9 AI tools</span>
                <span>{'>'} one command to rule them all</span>
                <span>{'>'} always up to date</span>
                <span>{'>'} absolute terminal control</span>
                <span>{'>'} configs stay in sync</span>
                <span>{'>'} works with 9 AI tools</span>
                <span>{'>'} one command to rule them all</span>
                <span>{'>'} always up to date</span>
                <span>{'>'} absolute terminal control</span>
            </div>
        </div>

        <style>{`
            @keyframes marquee {
                0% { transform: translateX(0%); }
                100% { transform: translateX(-50%); }
            }
            .animate-marquee {
                animation: marquee 25s linear infinite;
                width: 200%;
            }
        `}</style>
    </section>
  );
};
