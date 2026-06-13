import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, X, AlertCircle } from 'lucide-react';
import { firstAidGuides, type FirstAidGuide } from '../data/firstAid';

interface FirstAidDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirstAidDrawer = ({ isOpen, onClose }: FirstAidDrawerProps) => {
  const [selectedGuide, setSelectedGuide] = useState<FirstAidGuide | null>(null);

  // Reset view when closing
  const handleClose = () => {
    onClose();
    setTimeout(() => setSelectedGuide(null), 300);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[110] max-h-[85vh] rounded-t-3xl border-t border-white/[0.08] bg-[#13141a] shadow-2xl flex flex-col"
          >
            {/* Handle */}
            <div className="w-full flex justify-center pt-3 pb-2 shrink-0">
              <div className="h-1 w-12 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="px-5 pb-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {selectedGuide && (
                  <button
                    onClick={() => setSelectedGuide(null)}
                    className="h-8 w-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition mr-1"
                  >
                    <ChevronLeft className="h-5 w-5 text-white/70" />
                  </button>
                )}
                <div>
                  <h2 className="text-xl font-black text-white">
                    {selectedGuide ? selectedGuide.title : 'First-Aid Guide'}
                  </h2>
                  {!selectedGuide && (
                    <p className="text-xs text-white/50">Emergency instructions</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleClose}
                className="h-8 w-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition"
              >
                <X className="h-4 w-4 text-white/70" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="px-5 pb-8 overflow-y-auto overscroll-contain flex-1">
              <AnimatePresence mode="wait">
                {!selectedGuide ? (
                  <motion.div
                    key="grid"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid grid-cols-2 gap-3"
                  >
                    {firstAidGuides.map((guide) => (
                      <button
                        key={guide.id}
                        onClick={() => setSelectedGuide(guide)}
                        className="flex flex-col items-start gap-3 rounded-2xl border border-white/[0.06] bg-[#1a1b23] p-4 text-left transition hover:border-white/[0.12] active:scale-95"
                      >
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl"
                          style={{ backgroundColor: `${guide.color}20` }}
                        >
                          <guide.icon className="h-5 w-5" style={{ color: guide.color }} />
                        </div>
                        <span className="font-bold text-white/90 text-sm">{guide.title}</span>
                      </button>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="detail"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4"
                  >
                    {selectedGuide.warning && (
                      <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                        <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
                        <div>
                          <div className="text-xs font-black uppercase tracking-widest text-red-300">
                            Critical Warning
                          </div>
                          <div className="mt-1 text-sm font-semibold text-red-100">
                            {selectedGuide.warning}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 mt-4">
                      {selectedGuide.steps.map((step, index) => (
                        <div
                          key={index}
                          className="flex gap-4 rounded-2xl border border-white/[0.04] bg-[#1a1b23] p-4"
                        >
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black"
                            style={{
                              backgroundColor: `${selectedGuide.color}20`,
                              color: selectedGuide.color,
                            }}
                          >
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm">{step.title}</div>
                            <div className="mt-1 text-xs text-white/60 leading-relaxed">
                              {step.description}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
