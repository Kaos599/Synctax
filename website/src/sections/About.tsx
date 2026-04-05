import React from 'react';

const STATS = [
  { value: '9', label: 'AI TOOLS SUPPORTED', color: 'text-[#00FF00]' },
  { value: '1', label: 'FILE TO MANAGE', color: 'text-white' },
  { value: 'v4.1.0', label: 'CURRENT VERSION', color: 'text-white' },
  { value: 'MIT', label: 'ALWAYS FREE', color: 'text-[#FF007F]' },
];

export const About = () => {
  return (
    <section id="about" className="min-h-screen bg-black pt-32 pb-24 px-8 md:px-16 flex flex-col justify-center">
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-5 gap-16 items-start">

        {/* Left Bio — 3 cols */}
        <div className="md:col-span-3">
          <p className="font-mono text-[#00FF00] text-xs tracking-widest uppercase mb-8">
            SEC // ABOUT
          </p>
          <h2 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold uppercase tracking-tighter leading-none mb-12">
            BUILT FOR<br />
            <span className="text-[#FF007F]">PEOPLE WHO SHIP.</span>
          </h2>

          <p className="font-mono text-base text-[#777] leading-relaxed mb-10 max-w-lg">
            I built Synctax because I needed it. One config file. All my AI tools in sync.
            No accounts. No cloud. No drama. Just a tool that does exactly what it says
            and gets out of your way.
          </p>

          {/* Pull-quote testimonial */}
          <div className="border-l-2 border-[#00FF00] pl-6 mb-12">
            <p className="font-display text-xl text-white font-bold leading-snug mb-3">
              "I have 9 AI tools. Now I have one config file. Game changer."
            </p>
            <p className="font-mono text-xs text-[#555]">
              @kaos599 &mdash; Power user
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-8 font-mono text-xs font-bold uppercase tracking-widest">
            <a
              href="https://github.com/kaos599"
              className="text-[#aaa] hover:text-[#00FF00] transition-colors relative group"
            >
              GitHub
              <span className="absolute -bottom-px left-0 w-0 h-px bg-[#00FF00] transition-all duration-200 group-hover:w-full" />
            </a>
          </div>
        </div>

        {/* Right Stats Grid — 2 cols */}
        <div className="md:col-span-2">
          <div className="grid grid-cols-2 gap-px bg-[#111] border border-[#111]">
            {STATS.map((stat, i) => (
              <div
                key={i}
                className="bg-black p-8 flex flex-col justify-end min-h-[180px] hover:bg-[#060606] transition-colors group cursor-default"
              >
                <span className="font-mono text-[9px] text-[#444] mb-3 uppercase tracking-widest group-hover:text-[#666] transition-colors">
                  {stat.label}
                </span>
                <span className={`font-display text-5xl font-bold leading-none ${stat.color}`}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
