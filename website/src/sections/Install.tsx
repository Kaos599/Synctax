import React from 'react';
import { TerminalBlock } from '../components/ui/TerminalBlock';

export const Install = () => {
  return (
    <section id="install" className="min-h-screen bg-black pt-32 pb-24 px-8 md:px-16 border-b border-[#111] flex flex-col justify-center">
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

        {/* Left Content */}
        <div>
          <p className="font-mono text-[#00FF00] text-xs tracking-widest uppercase mb-8">
            SEC // DOWNLOAD
          </p>
          <h2 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold uppercase tracking-tighter leading-none mb-16">
            UP AND<br />
            RUNNING IN<br />
            <span className="text-[#00FF00]">30 SECONDS.</span>
          </h2>

          <div className="flex flex-col gap-10">
            {/* Step 01 */}
            <div className="flex gap-6 items-start group">
              <div className="font-mono text-xs border border-white text-white px-3 py-2 bg-black shrink-0 mt-1 group-hover:border-[#00FF00] group-hover:text-[#00FF00] transition-colors">
                01
              </div>
              <div>
                <h4 className="font-display text-xl font-bold uppercase mb-2 group-hover:text-[#00FF00] transition-colors">
                  Download Synctax
                </h4>
                <p className="font-mono text-sm text-[#666] leading-relaxed">
                  Works everywhere Node runs. One install, nothing else needed.
                </p>
              </div>
            </div>

            {/* Step 02 */}
            <div className="flex gap-6 items-start group">
              <div className="font-mono text-xs border border-[#00FF00] text-[#00FF00] px-3 py-2 bg-black shrink-0 mt-1">
                02
              </div>
              <div>
                <h4 className="font-display text-xl font-bold uppercase mb-2">
                  Run the Setup
                </h4>
                <p className="font-mono text-sm text-[#666] leading-relaxed">
                  Synctax finds Claude Desktop, Cursor, Zed, and 6 other tools — automatically.
                </p>
              </div>
            </div>

            {/* Step 03 */}
            <div className="flex gap-6 items-start group">
              <div className="font-mono text-xs border border-[#FF007F] text-[#FF007F] px-3 py-2 bg-black shrink-0 mt-1">
                03
              </div>
              <div>
                <h4 className="font-display text-xl font-bold uppercase mb-2">
                  Edit Once. Done.
                </h4>
                <p className="font-mono text-sm text-[#666] leading-relaxed">
                  Change your single config file. Every connected tool updates immediately.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right — Terminal */}
        <div className="flex flex-col gap-6">
          <TerminalBlock code="npm install -g synctax" />
          <div className="pl-8 border-l border-[#1a1a1a]">
            <TerminalBlock code="synctax init" />
          </div>

          <div className="border-2 border-[#00FF00] p-6 bg-black shadow-[8px_8px_0_0_#222] transition-transform duration-300 hover:-translate-y-1 hover:-translate-x-1">
            <pre className="font-mono text-xs leading-relaxed overflow-x-auto">
              <span className="text-[#444]">{'> '}Scanning for tools...<br /></span>
              <br />
              <span className="text-[#00FF00]">{'[✓]'}</span>
              <span className="text-[#888]">{' Claude Desktop — found\n'}</span>
              <span className="text-[#00FF00]">{'[✓]'}</span>
              <span className="text-[#888]">{' Cursor — found\n'}</span>
              <span className="text-[#00FF00]">{'[✓]'}</span>
              <span className="text-[#888]">{' Windsurf — found\n'}</span>
              <span className="text-[#00FF00]">{'[✓]'}</span>
              <span className="text-[#888]">{' Zed — found\n'}</span>
              <br />
              <span className="text-[#444]">{'> '}Writing master config...<br /></span>
              <span className="text-[#00FF00] font-bold">{'[✓]'}</span>
              <span className="text-[#00FF00]">{' ~/.synctax.yaml created\n'}</span>
              <span className="text-[#00FF00] font-bold">{'[✓]'}</span>
              <span className="text-[#00FF00]">{' Symlinks generated\n'}</span>
              <br />
              <span className="text-[#00FF00] font-bold text-sm bg-[#005500] px-2 py-1">{'▶ SYSTEM ONLINE'}</span>
              <span className="text-[#00FF00] blink ml-2">█</span>
            </pre>
          </div>
        </div>

      </div>
    </section>
  );
};
