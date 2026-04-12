import React from 'react';
import { motion } from 'framer-motion';

const LOGS = [
  {
    version: "v4.1.0",
    date: "[ 2026.04.05 ]",
    latest: true,
    changes: [
      { type: "add", text: "Support for Claude Desktop MCP config format" },
      { type: "add", text: "New 'synctax profile' command — switch project contexts instantly" },
      { type: "fix", text: "Fixed config path issues on Windows Subsystem for Linux" },
      { type: "break", text: "Removed old Cursor settings format (use .synctax.yml instead)" },
    ],
  },
  {
    version: "v4.0.0",
    date: "[ 2026.03.28 ]",
    latest: false,
    changes: [
      { type: "break", text: "Rewrote the sync engine from scratch — 10x faster, zero config loss" },
      { type: "add", text: "Introduced the .synctax.yml master format — one file rules all" },
      { type: "fix", text: "Fixed a rare bug where two tools could write at the same time" },
    ],
  },
  {
    version: "v3.9.0",
    date: "[ 2026.02.14 ]",
    latest: false,
    changes: [
      { type: "add", text: "Added Windsurf and Zed as supported tools" },
      { type: "add", text: "Version history — roll back any config with a single command" },
      { type: "fix", text: "Fixed silent failures when a tool's config directory doesn't exist" },
    ],
  },
];

export const Changelog = () => {
  return (
    <section
      id="changelog"
      className="min-h-screen bg-[#040404] pt-32 pb-24 px-8 md:px-16 border-b border-[#111] flex flex-col justify-center"
    >
      <div className="max-w-5xl mx-auto w-full">

        <p className="font-mono text-[#00FF00] text-xs tracking-widest uppercase mb-8">
          SEC // CHANGELOG
        </p>
        <h2 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold uppercase tracking-tighter mb-16 pb-8 border-b border-[#111] leading-none">
          WHAT'S NEW.
        </h2>

        {/* Timeline Container */}
        <div className="relative border-l border-[#00FF00] ml-2 md:ml-4 flex flex-col gap-12 pb-12">
          {LOGS.map((log, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="relative pl-8 md:pl-12 group flex flex-col md:flex-row gap-0 items-stretch"
            >
              {/* Marker Dot exactly on the green border line */}
              <div 
                className={`absolute left-0 top-8 -translate-x-[50%] w-3 h-3 border border-[#00FF00] bg-black group-hover:scale-125 transition-transform duration-300 ${log.latest ? 'bg-[#00FF00]' : ''}`} 
              />

              {/* Version Side */}
              <div className="md:w-56 shrink-0 border border-transparent group-hover:border-[#333] transition-colors duration-300 px-6 py-8 flex flex-col justify-start relative z-10 bg-[#040404]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="font-display text-2xl font-bold text-white tracking-tighter">
                    {log.version}
                  </div>
                  {log.latest && (
                    <span className="font-mono text-[9px] tracking-widest bg-[#00FF00] text-black px-2 py-[2px] font-bold uppercase">
                      LATEST
                    </span>
                  )}
                </div>
                <div className="font-mono text-[10px] text-[#00FF00] group-hover:text-white transition-colors tracking-widest">
                  {log.date}
                </div>
              </div>

              {/* Changes Side */}
              <div className="flex flex-col gap-4 flex-1 font-mono text-xs bg-[#060606] group-hover:bg-[#0a0a0a] border border-[#111] group-hover:border-[#00FF00] transition-colors duration-300 p-8 w-full relative z-10">
                {log.changes.map((change, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    {change.type === 'add' && (
                      <span className="text-[#00FF00] shrink-0 font-bold">[+]</span>
                    )}
                    {change.type === 'fix' && (
                      <span className="text-[#aaa] shrink-0 font-bold">[~]</span>
                    )}
                    {change.type === 'break' && (
                      <span className="text-[#FF007F] shrink-0 font-bold">[!]</span>
                    )}
                    <span className="text-[#888] leading-relaxed group-hover:text-[#aaa] transition-colors">{change.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 border-t border-[#111] pt-8 ml-2 md:ml-4 pl-8 md:pl-12">
          <p className="font-mono text-[10px] text-[#444] uppercase tracking-widest flex flex-wrap gap-6">
            <span><span className="text-[#00FF00]">[+]</span> ADDED</span>
            <span><span className="text-[#aaa]">[~]</span> FIXED</span>
            <span><span className="text-[#FF007F]">[!]</span> BREAKING CHANGE</span>
          </p>
        </div>

      </div>
    </section>
  );
};
