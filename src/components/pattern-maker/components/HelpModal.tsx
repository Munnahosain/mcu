import React from 'react';
import { X, Sparkles, MousePointer, Scissors, ArrowRightLeft } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#07080a]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-[#101114] border border-[#252a31] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#252a31] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#18c98a]/15 text-[#18c98a] flex items-center justify-center border border-[#18c98a]/30">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#f5f7f8]">
                Automatic Edge Stitching (Zero-Math Seamless Repeat)
              </h2>
              <p className="text-[11px] text-[#aeb5bf]">
                How our 1:1 Artboard eliminates Adobe Illustrator&apos;s manual math
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#17191e] text-[#77808c] hover:text-[#f5f7f8] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-[#aeb5bf] leading-relaxed">
          {/* Comparison Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-rose-950/20 border border-rose-800/40 rounded-xl p-3.5 space-y-1.5">
              <div className="font-bold text-rose-400 text-xs flex items-center gap-1.5">
                <span>In Adobe Illustrator</span>
              </div>
              <p className="text-[11px] text-[#77808c]">
                You must manually open Object &gt; Transform &gt; Move, type the exact width (+500px or -500px), click Copy, and re-calculate every single time you nudge a motif!
              </p>
            </div>

            <div className="bg-[#18c98a]/10 border border-[#18c98a]/30 rounded-xl p-3.5 space-y-1.5">
              <div className="font-bold text-[#18c98a] text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#18c98a]" />
                <span>In This Pattern Studio</span>
              </div>
              <p className="text-[11px] text-[#18c98a]/90">
                <strong>Zero Math Required!</strong> Move any shape over the border with your mouse. The protruding portion automatically flips to the opposite side in real time with continuous toroidal stitching.
              </p>
            </div>
          </div>

          {/* Core Controls */}
          <div className="bg-[#17191e] rounded-xl p-4 border border-[#252a31] space-y-3">
            <h3 className="font-bold text-[#f5f7f8] text-xs flex items-center gap-1.5">
              <MousePointer className="w-3.5 h-3.5 text-[#18c98a]" />
              <span>Illustrator-Style Mouse & Keyboard Controls</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-start gap-2">
                <kbd className="bg-[#101114] px-1.5 py-0.5 rounded font-mono text-[#f5f7f8] border border-[#252a31]">
                  Mouse Drag
                </kbd>
                <span>Move element anywhere (wraps automatically).</span>
              </div>
              <div className="flex items-start gap-2">
                <kbd className="bg-[#101114] px-1.5 py-0.5 rounded font-mono text-[#f5f7f8] border border-[#252a31]">
                  8 Handles
                </kbd>
                <span>Resize freely (Hold Shift for 1:1 aspect ratio).</span>
              </div>
              <div className="flex items-start gap-2">
                <kbd className="bg-[#101114] px-1.5 py-0.5 rounded font-mono text-[#f5f7f8] border border-[#252a31]">
                  Top Stem
                </kbd>
                <span>Rotate (Hold Shift for 15° snap increments).</span>
              </div>
              <div className="flex items-start gap-2">
                <kbd className="bg-[#101114] px-1.5 py-0.5 rounded font-mono text-[#f5f7f8] border border-[#252a31]">
                  Alt + Drag
                </kbd>
                <span>Instant duplicate clone of the selected motif.</span>
              </div>
              <div className="flex items-start gap-2">
                <kbd className="bg-[#101114] px-1.5 py-0.5 rounded font-mono text-[#f5f7f8] border border-[#252a31]">
                  Arrow Keys
                </kbd>
                <span>Nudge position (Hold Shift for 10px leap).</span>
              </div>
              <div className="flex items-start gap-2">
                <kbd className="bg-[#101114] px-1.5 py-0.5 rounded font-mono text-[#f5f7f8] border border-[#252a31]">
                  Delete / Backspace
                </kbd>
                <span>Delete selected element.</span>
              </div>
            </div>
          </div>

          {/* Fabric Cutting Map Explanation */}
          <div className="bg-[#17191e] rounded-xl p-4 border border-[#252a31] space-y-2">
            <h3 className="font-bold text-[#f5f7f8] text-xs flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-[#18c98a]" />
              <span>Fabric Cutting & Customization Map</span>
            </h3>
            <p className="text-[11px] text-[#aeb5bf] leading-relaxed">
              Switch to the <strong>Cutting Map</strong> tab at the top to see exact fabric bolt widths (44&quot;, 55&quot;, 60&quot; or 110cm, 140cm), total whole repeat counts, selvage margins, and print-ready 300 DPI specifications for digital textile printing.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#252a31] flex justify-end bg-[#0b0c0e]">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#18c98a] hover:bg-[#14b179] text-[#071b17] font-bold rounded-lg text-xs transition shadow-sm"
          >
            Got it, Let&apos;s Design!
          </button>
        </div>
      </div>
    </div>
  );
};
