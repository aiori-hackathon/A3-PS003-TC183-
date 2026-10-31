import React from 'react';
import { useApp } from '../context/AppContext';
import { sound } from '../utils/audio';

export const KeyboardShortcutsModal: React.FC = () => {
  const { isShortcutsOpen, setIsShortcutsOpen } = useApp();

  if (!isShortcutsOpen) return null;

  const shortcuts = [
    {
      category: 'Navigation',
      items: [
        { keys: ['1'], action: 'Problem & Overview' },
        { keys: ['2'], action: 'Federated Simulator' },
        { keys: ['3'], action: 'Centralized vs FedAvg Benchmark' },
        { keys: ['4'], action: 'Client Non-IID Telemetry' },
        { keys: ['5'], action: 'Communication & Convergence' },
        { keys: ['6'], action: 'Experiments & Compare' },
        { keys: ['7'], action: 'Methodology & Sources' },
      ],
    },
    {
      category: 'Simulation Controls',
      items: [
        { keys: ['Space'], action: 'Run / Pause / Resume experiment' },
        { keys: ['S'], action: 'Run 1 round, then pause' },
        { keys: ['R'], action: 'Cancel active run & reset view' },
      ],
    },
    {
      category: 'Global Modals & Tools',
      items: [
        { keys: ['Ctrl', 'K'], action: 'Global Search Palette' },
        { keys: ['P'], action: 'Toggle Researcher Profile' },
        { keys: ['N'], action: 'Edge Nodes Mesh Inspector' },
        { keys: ['E'], action: 'Export Executive Evaluation Report' },
        { keys: ['?'], action: 'Open Keyboard Shortcuts Help' },
        { keys: ['Esc'], action: 'Close any open modal or drawer' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div
        className="fixed inset-0 -z-10 cursor-pointer"
        onClick={() => {
          sound.playTick();
          setIsShortcutsOpen(false);
        }}
      />
      <div className="w-full max-w-xl bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-surface-container-low border-b border-surface-container flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">keyboard</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-on-surface-variant">
                Power-user hotkeys for swift platform navigation
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playTick();
              setIsShortcutsOpen(false);
            }}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
          {shortcuts.map((group) => (
            <div key={group.category} className="space-y-2.5">
              <h3 className="text-xs uppercase font-bold tracking-wider text-secondary">
                {group.category}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-surface-container-low rounded-xl border border-surface-container/70 text-body-sm"
                  >
                    <span className="text-on-surface font-medium truncate pr-2">
                      {item.action}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-2 py-0.5 bg-surface-container-high text-on-surface rounded font-mono text-[11px] font-bold border border-surface-container-highest shadow-2xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-surface-container-low border-t border-surface-container flex items-center justify-between text-xs text-on-surface-variant">
          <span>Press <kbd className="px-1.5 py-0.5 bg-surface-container rounded font-mono text-[10px]">Esc</kbd> anytime to dismiss</span>
          <button
            onClick={() => {
              sound.playTick();
              setIsShortcutsOpen(false);
            }}
            className="px-3 py-1 bg-secondary text-on-secondary rounded-lg font-semibold cursor-pointer hover:bg-secondary/90 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

