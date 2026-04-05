import React from 'react';

const LOGS = [
  {
    version: "v4.1.0",
    date: "2026-04-05",
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
    date: "2026-03-28",
    latest: false,
    changes: [
      { type: "break", text: "Rewrote the sync engine from scratch — 10x faster, zero config loss" },
      { type: "add", text: "Introduced the .synctax.yml master format — one file rules all" },
      { type: "fix", text: "Fixed a rare bug where two tools could write at the same time" },
    ],
  },
  {
    version: "v3.9.0",
    date: "2026-02-14",
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

        <div className="flex flex-col gap-0">
          {LOGS.map((log, index) => (
            <div
              key={index}
              className="flex flex-col md:flex-row gap-0 items-stretch group animate-fade-in-up border-b border-[#111]"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Version Side */}
              <div className="md:w-56 shrink-0 border-l-2 border-[#1a1a1a] group-hover:border-[#00FF00] transition-colors duration-200 px-6 py-8 flex flex-col justify-start">
                <div className="flex items-center gap-3 mb-2">
                  <div className="font-display text-xl font-bold text-white">
                    {log.version}
                  </div>
                  {log.latest && (
                    <span className="font-mono text-[9px] tracking-widest bg-[#00FF00] text-black px-2 py-[2px] font-bold uppercase">
                      LATEST
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs text-[#444]">
                  {log.date}
                </div>
              </div>

              {/* Changes Side */}
              <div className="flex flex-col gap-3 flex-1 font-mono text-xs bg-[#060606] group-hover:bg-[#080808] transition-colors p-8 w-full">
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
                    <span className="text-[#888] leading-relaxed">{change.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-[#111] pt-8">
          <p className="font-mono text-xs text-[#333] uppercase tracking-widest">
            [+] Added &nbsp; [~] Fixed &nbsp; [!] Breaking change
          </p>
        </div>

      </div>
    </section>
  );
};
