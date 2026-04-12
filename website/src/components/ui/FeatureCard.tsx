import React, { useState } from 'react';
import { Terminal, MoveRight } from 'lucide-react';

interface FeatureCardProps {
  id: string;
  title: string;
  description: string;
  details?: string;
}

// Unique geometric art per card
const CardArt = ({ id }: { id: string }) => {
  const base = "w-full h-full relative";

  if (id === '01') return (
    <div className={base + " flex items-center justify-center"}>
      {/* Crosshair center + nested diamonds */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-px h-full bg-[#ddd] absolute left-1/2" />
        <div className="h-px w-full bg-[#ddd] absolute top-1/2" />
      </div>
      <div className="w-28 h-28 border-2 border-black rotate-45 flex items-center justify-center group-hover:border-[#00FF00] transition-colors duration-300">
        <div className="w-16 h-16 border border-black rotate-0 flex items-center justify-center group-hover:border-black transition-colors">
          <div className="w-6 h-6 bg-black group-hover:bg-[#00FF00] transition-colors duration-500" />
        </div>
      </div>
      <div className="absolute top-4 left-4 w-2 h-2 bg-black group-hover:bg-[#00FF00] transition-colors" />
      <div className="absolute bottom-4 right-4 w-2 h-2 bg-black group-hover:bg-[#00FF00] transition-colors delay-100" />
    </div>
  );

  if (id === '02') return (
    <div className={base}>
      {/* 5×5 grid */}
      <div className="w-full h-full grid grid-cols-5 grid-rows-5">
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} className={`border border-[#e0e0e0] transition-colors duration-300 ${
            [2, 6, 8, 12, 16, 18, 22].includes(i) ? 'bg-black group-hover:bg-[#00FF00]' :
            [0, 4, 20, 24].includes(i) ? 'bg-[#222] group-hover:bg-[#FF007F] transition-colors delay-100' :
            'bg-transparent'
          }`} />
        ))}
      </div>
    </div>
  );

  if (id === '03') return (
    <div className={base + " flex items-center justify-center p-8"}>
      {/* Split block */}
      <div className="w-full h-full flex flex-col gap-3">
        <div className="flex gap-3 flex-1">
          <div className="flex-1 bg-black group-hover:bg-[#00FF00] transition-colors duration-200" />
          <div className="flex-[2] border border-black group-hover:border-[#00FF00] transition-colors" />
        </div>
        <div className="flex gap-3 flex-1">
          <div className="flex-[2] border border-black group-hover:border-[#00FF00] transition-colors" />
          <div className="flex-1 bg-black group-hover:bg-[#FF007F] transition-colors duration-200 delay-100" />
        </div>
      </div>
    </div>
  );

  if (id === '04') return (
    <div className={base + " flex items-center justify-center p-8"}>
      {/* Arrow / diagonal lines */}
      <div className="w-full h-full relative overflow-hidden border border-black group-hover:border-[#00FF00] transition-colors">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-black group-hover:bg-[#00FF00] transition-colors" />
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-black group-hover:bg-[#00FF00] transition-colors delay-100" />
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-[#ccc] -rotate-[15deg] origin-left group-hover:bg-black transition-colors" />
        <div className="absolute bottom-8 left-0 w-1/2 h-1/2 bg-[#f0f0f0] group-hover:bg-[#00FF00] transition-colors delay-200" />
        <div className="absolute top-6 right-6 w-8 h-8 border-2 border-black" />
      </div>
    </div>
  );

  if (id === '05') return (
    <div className={base + " flex items-center justify-center p-8"}>
      {/* Concentric squares — no circles */}
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="absolute w-full h-full border border-[#ccc] group-hover:border-[#00FF00] transition-colors" />
        <div className="absolute w-3/4 h-3/4 border border-[#ccc] group-hover:border-black transition-colors delay-75" />
        <div className="absolute w-1/2 h-1/2 border border-[#ccc] group-hover:border-black transition-colors delay-150" />
        <div className="w-6 h-6 bg-black group-hover:bg-[#FF007F] transition-colors delay-200" />
      </div>
    </div>
  );

  // id === '06'
  return (
    <div className={base + " flex items-center justify-center p-8"}>
      {/* Horizontal bars — bar chart feel */}
      <div className="w-full h-full flex flex-col justify-end gap-2">
        {[0.3, 0.6, 0.45, 0.9, 0.2, 0.75].map((frac, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className="h-4 bg-[#ddd] group-hover:bg-[#00FF00] transition-all duration-300"
              style={{ width: `${frac * 100}%`, transitionDelay: `${i * 40}ms` }}
            />
            <div className="w-4 h-4 shrink-0 bg-black opacity-0 group-hover:opacity-100 transition-opacity" style={{ transitionDelay: `${i * 40 + 200}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
};

export const FeatureCard = ({ id, title, description, details }: FeatureCardProps) => {
  const [showDetails, setShowDetails] = useState(false);
  
  return (
    <div
      className="
        w-[85vw] md:w-[400px] shrink-0
        border border-[#1a1a1a] bg-black
        flex flex-col group
        transition-all duration-200
        hover:border-[#333]
        hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_#00FF00]
      "
    >
      {/* Top Header — black on black, system label style */}
      <div className="flex items-center justify-between px-6 py-4 bg-black font-mono text-xs border-b border-[#1a1a1a] font-bold">
        <span className="text-[#555]">SEC_{id}</span>
        <Terminal size={14} className="text-[#333] group-hover:text-[#00FF00] transition-colors" />
      </div>

      {/* Body — white card = high contrast against outer black */}
      <div className="flex-1 flex flex-col bg-[#f8f8f8] relative overflow-hidden">

        {/* Scanline overlay on hover */}
        <div
          className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"
          style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)'
          }}
        />

        {/* Title + Description */}
        <div className="px-6 pt-8 pb-6 relative z-20">
          <h3 className="font-display text-3xl font-bold uppercase tracking-tight text-black leading-none mb-4">
            {title}
          </h3>
          <p className="font-mono text-[10px] uppercase tracking-wide text-[#444] leading-relaxed">
            {description}
          </p>
        </div>

        {/* Geometric Art Box */}
        <div className="mx-6 mb-6 aspect-square bg-white border border-[#e8e8e8] relative overflow-hidden z-20 group-hover:border-[#ccc] transition-colors">
          <CardArt id={id} />
        </div>

        {/* Detailed Overlay */}
        {details && (
          <div 
            className={`absolute inset-0 bg-black p-8 z-30 flex flex-col justify-center transition-transform duration-300 border-t border-[#00FF00] ${showDetails ? 'translate-y-0' : 'translate-y-[101%]'}`}
          >
            <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-[#00FF00] leading-none mb-4">
              HOW IT WORKS_
            </h3>
            <p className="font-mono text-xs text-[#ccc] leading-relaxed">
              {details}
            </p>
          </div>
        )}

      </div>

      {/* Button Stack */}
      <div className="flex flex-col border-t border-[#1a1a1a] bg-black">
        <button 
          onMouseEnter={() => setShowDetails(true)}
          onMouseLeave={() => setShowDetails(false)}
          onClick={() => setShowDetails(!showDetails)}
          className="
          w-full h-14
          bg-[#00FF00] hover:bg-white
          text-black font-mono font-bold text-xs tracking-widest
          transition-colors duration-150
          flex items-center justify-between px-6 shrink-0
          group/btn
        ">
          <span>{showDetails ? 'CLOSE DETAILS' : 'GET STARTED'}</span>
          <MoveRight size={16} className={`transition-transform duration-200 ${showDetails ? '-translate-x-1 rotate-180' : 'group-hover/btn:translate-x-1'}`} />
        </button>
        <button className="
          w-full h-12
          bg-black hover:bg-[#0a0a0a]
          text-[#888] hover:text-white border-t border-[#1a1a1a]
          font-mono text-xs tracking-widest
          transition-colors duration-150
          flex items-center justify-center px-6 shrink-0
        ">
          SEE DOCS
        </button>
      </div>
    </div>
  );
};
