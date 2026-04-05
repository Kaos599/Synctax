import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface TerminalBlockProps {
  code: string;
}

export const TerminalBlock = ({ code }: TerminalBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative border border-[#333] bg-[#0a0a0a] group">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#333] bg-[#111]">
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-[#333]" />
          <div className="w-2 h-2 rounded-full bg-[#333]" />
          <div className="w-2 h-2 rounded-full bg-[#333]" />
        </div>
        <span className="font-mono text-[10px] text-[#666]">zsh — 80x24</span>
      </div>
      
      {/* Code Area */}
      <div className="p-6 font-mono text-sm leading-relaxed overflow-x-auto text-[#00FF00]">
        <code>$ {code}</code>
      </div>

      {/* Copy Button */}
      <button 
        onClick={handleCopy}
        className="absolute top-12 right-4 p-2 border border-[#333] bg-black text-white hover:border-[#00FF00] hover:text-[#00FF00] transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
};
