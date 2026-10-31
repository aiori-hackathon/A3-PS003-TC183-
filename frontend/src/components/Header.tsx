import React, { useState } from 'react';
import { PageId } from './Sidebar';
import { useApp } from '../context/AppContext';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  activeTab: PageId;
  onSelectTab: (tab: PageId) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  activeTab,
  onSelectTab,
}) => {
  const {
    currentSeed,
    setCurrentSeed,
    currentClients,
    networkTransferredMB,
    setIsSearchOpen,
    setIsProfileOpen,
    setIsNodeClusterModalOpen,
    setIsReportOpen,
    setIsShortcutsOpen,
    isSoundMuted,
    toggleSound,
    userProfile,
    addToast,
  } = useApp();

  const [seedDropdownOpen, setSeedDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const seeds = [42, 108, 999];

  const handleSelectSeed = (s: number) => {
    setCurrentSeed(s);
    setSeedDropdownOpen(false);
    addToast(`Seed ${s} Selected`, `The next experiment you start will use seed ${s}.`, 'info');
  };

  return (
    <header className="fixed top-0 left-0 lg:left-72 right-0 h-16 bg-surface/90 backdrop-blur-xl z-40 flex items-center justify-between px-space-md lg:px-space-margin-desktop border-b border-surface-container/60 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      {/* Left side: Mobile Toggle & Quick Telemetry Buttons */}
      <div className="flex items-center gap-space-xs sm:gap-space-sm lg:gap-space-md">
        {/* Mobile menu button */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-1.5 text-on-surface-variant hover:text-on-surface bg-surface-container rounded-lg cursor-pointer transition-colors"
          aria-label="Toggle navigation"
        >
          <span className="material-symbols-outlined text-[20px]">menu</span>
        </button>

        {/* Interactive Seeds Selector */}
        <div className="relative">
          <button
            onClick={() => setSeedDropdownOpen(!seedDropdownOpen)}
            className="flex items-center gap-space-xs bg-surface-container hover:bg-surface-container-high px-space-sm py-1.5 rounded-lg transition-colors cursor-pointer"
            title="Click to switch deterministic random seed"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">
              tag
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant hidden sm:inline">
              Seed:
            </span>
            <span className="font-label-sm text-label-sm font-bold text-on-surface">
              {currentSeed}
            </span>
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
              expand_more
            </span>
          </button>

          {seedDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-surface-container-lowest border border-surface-container rounded-xl shadow-xl py-1.5 w-44 z-50 animate-fade-in">
              <div className="px-3 py-1 text-[11px] font-label-sm text-on-surface-variant uppercase font-semibold border-b border-surface-container">
                Switch Seed (3-Runs)
              </div>
              {seeds.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSelectSeed(s)}
                  className={`w-full px-3 py-1.5 text-left font-label-sm text-label-sm flex items-center justify-between transition-colors cursor-pointer ${
                    currentSeed === s
                      ? 'bg-secondary/10 text-secondary font-bold'
                      : 'text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span>Seed {s}</span>
                  {currentSeed === s && (
                    <span className="material-symbols-outlined text-[16px] text-secondary">
                      check
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Interactive Edge Nodes Badge -> Opens Cluster Modal */}
        <button
          onClick={() => setIsNodeClusterModalOpen(true)}
          className="hidden md:flex items-center gap-space-xs bg-surface-container-low hover:bg-surface-container px-space-sm py-1.5 rounded-lg transition-colors cursor-pointer"
          title="Click to inspect Edge Node Mesh & dropouts"
        >
          <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse"></span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Clients:
          </span>
          <span className="font-label-sm text-label-sm font-bold text-on-surface">
            {currentClients}
          </span>
        </button>

        {/* Dynamic Network MB Transferred -> Jumps to Comm Analysis */}
        <button
          onClick={() => onSelectTab('communication-and-convergence-analysis')}
          className="hidden xl:flex items-center gap-space-xs bg-surface-container-low hover:bg-surface-container px-space-sm py-1.5 rounded-lg transition-colors cursor-pointer"
          title="Click to view Communication & Convergence analysis"
        >
          <span className="material-symbols-outlined text-[16px] text-secondary">
            swap_vert
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Network:
          </span>
          <span className="font-label-sm text-label-sm font-bold text-on-surface">
            {networkTransferredMB === null ? '—' : networkTransferredMB.toFixed(2)} MB Transferred
          </span>
        </button>
      </div>

      {/* Center Search Bar */}
      <div className="flex-1 max-w-md mx-2 sm:mx-4">
        <button
          onClick={() => setIsSearchOpen(true)}
          className="w-full flex items-center justify-between px-3 py-1.5 bg-surface-container/70 hover:bg-surface-container border border-surface-container-high rounded-xl text-left transition-all cursor-pointer group shadow-2xs"
          title="Search site & commands (Ctrl+K)"
        >
          <div className="flex items-center gap-2 text-on-surface-variant group-hover:text-on-surface truncate">
            <span className="material-symbols-outlined text-[18px] text-secondary">
              search
            </span>
            <span className="font-body-sm text-body-sm truncate">
              Search evaluation, metrics, docs...
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-0.5">
            <kbd className="px-1.5 py-0.5 bg-surface-container-high rounded text-[10px] font-mono text-on-surface-variant">
              Ctrl
            </kbd>
            <kbd className="px-1.5 py-0.5 bg-surface-container-high rounded text-[10px] font-mono text-on-surface-variant">
              K
            </kbd>
          </div>
        </button>
      </div>

      {/* Right side: Tools, Report, Audio, Hotkeys, Profile Option */}
      <div className="flex items-center gap-space-xs sm:gap-1.5">
        {/* Live System Health Badge */}
        <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 bg-surface-container rounded-lg text-xs font-medium text-on-surface-variant">
          <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse"></span>
          <span>Mesh: <strong className="text-on-surface">Nominal</strong></span>
          <span className="opacity-40">•</span>
          <span className="font-mono text-[10px] text-secondary">14ms</span>
        </div>

        {/* Executive Report Generator Button */}
        <button
          onClick={() => setIsReportOpen(true)}
          className="hidden sm:flex items-center gap-1.5 px-space-sm py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg font-label-sm text-label-sm transition-colors cursor-pointer"
          title="Open Executive Evaluation Report & Print/PDF (Press E)"
        >
          <span className="material-symbols-outlined text-[16px] text-secondary">
            assignment
          </span>
          <span className="hidden md:inline">Report</span>
        </button>

        {/* Docs Button */}
        {activeTab === 'features-benefits-and-sources' ? (
          <div className="hidden sm:flex items-center gap-space-xs px-space-sm py-1.5 bg-surface-container text-on-surface rounded-lg font-label-sm text-label-sm font-semibold">
            <span className="material-symbols-outlined text-[16px] text-secondary">
              menu_book
            </span>
            <span>Docs</span>
          </div>
        ) : (
          <button
            onClick={() => onSelectTab('features-benefits-and-sources')}
            className="hidden sm:flex items-center gap-space-xs px-space-sm py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg font-label-sm text-label-sm transition-colors cursor-pointer"
            title="System Specifications & Research Citations"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">
              menu_book
            </span>
            <span>Docs</span>
          </button>
        )}

        {/* Sound Feedback Toggle */}
        <button
          onClick={toggleSound}
          className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          title={isSoundMuted ? 'Unmute Audio Synthesizer' : 'Mute Audio Synthesizer'}
          aria-label="Toggle Sound"
        >
          <span className="material-symbols-outlined text-[18px]">
            {isSoundMuted ? 'volume_off' : 'volume_up'}
          </span>
        </button>

        {/* Keyboard Shortcuts Dialog Trigger */}
        <button
          onClick={() => setIsShortcutsOpen(true)}
          className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          title="Keyboard Shortcuts Cheat Sheet (Press ?)"
          aria-label="Keyboard shortcuts"
        >
          <span className="material-symbols-outlined text-[18px]">keyboard</span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="hidden md:flex p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          aria-label="Fullscreen"
        >
          <span className="material-symbols-outlined text-[18px]">
            {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
          </span>
        </button>

        {/* FULLY FUNCTIONAL PROFILE OPTION */}
        <button
          onClick={() => setIsProfileOpen(true)}
          className="relative flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high transition-all cursor-pointer group border border-transparent hover:border-secondary/40"
          title={`Researcher: ${userProfile.name} (${userProfile.role}) - Click to manage profile & settings`}
        >
          <div
            className={`w-8 h-8 rounded-full bg-gradient-to-tr ${
              userProfile.avatarColor || 'from-secondary to-primary'
            } flex items-center justify-center text-on-primary font-bold text-xs shadow-sm shrink-0`}
          >
            {userProfile.avatarIcon && userProfile.avatarIcon !== 'initials' ? (
              <span className="material-symbols-outlined text-[16px]">{userProfile.avatarIcon}</span>
            ) : (
              userProfile.name
                .trim()
                .split(/\s+/)
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
            )}
          </div>
          <div className="hidden lg:flex flex-col text-left leading-tight">
            <span className="font-headline-sm text-[12px] font-bold text-on-surface group-hover:text-secondary transition-colors">
              {userProfile.name.split(' ')[0]} {userProfile.name.split(' ')[1]?.[0] ? `${userProfile.name.split(' ')[1][0]}.` : ''}
            </span>
            <span className="font-label-sm text-[10px] text-on-surface-variant truncate max-w-[110px]">
              {userProfile.role}
            </span>
          </div>
          {/* Active online pulse ring */}
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-on-tertiary-container border-2 border-surface flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
          </span>
        </button>
      </div>
    </header>
  );
};
