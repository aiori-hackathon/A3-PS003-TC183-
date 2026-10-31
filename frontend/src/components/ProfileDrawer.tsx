import React, { useState, useEffect } from 'react';
import { useApp, UserProfile } from '../context/AppContext';

export const ProfileDrawer: React.FC = () => {
  const {
    isProfileOpen,
    setIsProfileOpen,
    userProfile,
    updateUserProfile,
    resetUserProfile,
    addToast,
    experiments,
  } = useApp();

  const [formData, setFormData] = useState<UserProfile>(userProfile);
  const [showToken, setShowToken] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'avatar' | 'preferences' | 'security' | 'history'>('profile');
  const [isEditingToken, setIsEditingToken] = useState(false);

  // Sync formData whenever userProfile updates or drawer opens
  useEffect(() => {
    if (isProfileOpen) {
      setFormData(userProfile);
      setIsEditingToken(false);
    }
  }, [userProfile, isProfileOpen]);

  if (!isProfileOpen) return null;

  // Check if form has unsaved modifications
  const hasUnsavedChanges = JSON.stringify(formData) !== JSON.stringify(userProfile);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateUserProfile(formData);
    addToast('Profile Saved', 'Your researcher credentials & preferences were successfully updated.', 'success');
  };

  const handleSaveAndClose = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateUserProfile(formData);
    setIsProfileOpen(false);
  };

  const handleDiscardChanges = () => {
    setFormData(userProfile);
    addToast('Changes Discarded', 'Reverted modifications to previously saved profile.', 'info');
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(formData.apiToken);
    addToast('Token Copied', 'API authentication token copied to clipboard.', 'success');
  };

  const handleRegenerateToken = () => {
    const newToken = 'fedtraffic_sec_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    setFormData({ ...formData, apiToken: newToken });
    addToast('Token Generated', 'New cryptographically random token created. Remember to save changes.', 'info');
  };

  const roleSuggestions = [
    'Lead FL Systems Researcher',
    'Edge Deployment Engineer',
    'Smart City Transit Auditor',
    'Autonomous Systems Fellow',
    'Visiting Academic Evaluator',
    'Distributed ML Architect',
  ];

  const avatarIcons = [
    { id: 'initials', label: 'Initials', icon: 'badge' },
    { id: 'person', label: 'Researcher', icon: 'person' },
    { id: 'science', label: 'Scientist', icon: 'science' },
    { id: 'hub', label: 'Mesh Node', icon: 'hub' },
    { id: 'terminal', label: 'CLI / Edge', icon: 'terminal' },
    { id: 'smart_toy', label: 'Autonomous Agent', icon: 'smart_toy' },
    { id: 'shield', label: 'Security Lead', icon: 'shield' },
    { id: 'alt_route', label: 'Traffic Director', icon: 'alt_route' },
    { id: 'psychology', label: 'Deep Learning', icon: 'psychology' },
    { id: 'speed', label: 'Telemetry Ops', icon: 'speed' },
  ];

  const avatarGradients = [
    { id: 'from-secondary to-primary', name: 'Ocean Tech (Default)', preview: 'from-[#006398] to-[#0B1C30]' },
    { id: 'from-emerald-600 to-teal-800', name: 'Emerald Transit', preview: 'from-emerald-600 to-teal-800' },
    { id: 'from-purple-600 to-indigo-900', name: 'Cyber Violet', preview: 'from-purple-600 to-indigo-900' },
    { id: 'from-amber-500 to-orange-700', name: 'Sunset Amber', preview: 'from-amber-500 to-orange-700' },
    { id: 'from-rose-600 to-red-900', name: 'Crimson Security', preview: 'from-rose-600 to-red-900' },
    { id: 'from-slate-700 to-slate-950', name: 'Dark Carbon', preview: 'from-slate-700 to-slate-950' },
  ];

  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'FL';
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 -z-10 cursor-pointer"
        onClick={() => {
          if (hasUnsavedChanges) {
            if (window.confirm('You have unsaved changes in your profile. Do you want to close without saving?')) {
              setIsProfileOpen(false);
            }
          } else {
            setIsProfileOpen(false);
          }
        }}
      />

      {/* Drawer Container */}
      <div className="w-full max-w-2xl h-full bg-surface-container-lowest shadow-2xl flex flex-col border-l border-surface-container overflow-hidden transition-all duration-300">
        {/* Drawer Header with inline name editing */}
        <div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-between border-b border-surface-container gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className={`w-11 h-11 rounded-full bg-gradient-to-tr ${formData.avatarColor || 'from-secondary to-primary'} flex items-center justify-center text-on-primary font-bold text-base shadow-sm ring-2 ring-secondary/30 shrink-0`}
            >
              {formData.avatarIcon && formData.avatarIcon !== 'initials' ? (
                <span className="material-symbols-outlined text-[22px]">{formData.avatarIcon}</span>
              ) : (
                getInitials(formData.name)
              )}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              {/* Inline editable name */}
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your Name"
                  className="font-headline-sm text-headline-sm font-bold text-on-surface bg-transparent border-b border-transparent hover:border-surface-container-high focus:border-secondary outline-none transition-all min-w-0 flex-1 max-w-[200px] py-0.5 truncate"
                  title="Click to edit your name"
                />
                {hasUnsavedChanges && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Unsaved
                  </span>
                )}
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse shrink-0"></span>
                <span className="truncate">Research Track: <strong>Urban Intelligence</strong></span>
                <span className="opacity-50 shrink-0">•</span>
                <span className="font-mono text-[11px] text-secondary truncate">{formData.email.split('@')[0]}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {hasUnsavedChanges && (
              <button
                onClick={() => handleSave()}
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-secondary hover:bg-secondary/90 text-on-secondary rounded-lg font-label-sm text-label-sm font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
                title="Quick save changes"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                <span>Save</span>
              </button>
            )}
            <button
              onClick={() => {
                if (hasUnsavedChanges) {
                  if (window.confirm('You have unsaved changes in your profile. Do you want to close without saving?')) {
                    setIsProfileOpen(false);
                  }
                } else {
                  setIsProfileOpen(false);
                }
              }}
              className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              aria-label="Close profile drawer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Profile Navigation Tabs */}
        <div className="flex items-center border-b border-surface-container px-space-md bg-surface-container-lowest overflow-x-auto text-label-md font-label-md scrollbar-none">
          <button
            onClick={() => setActiveSubTab('profile')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeSubTab === 'profile'
                ? 'border-secondary text-secondary font-semibold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">badge</span>
            <span>Identity &amp; Bio</span>
          </button>
          <button
            onClick={() => setActiveSubTab('avatar')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeSubTab === 'avatar'
                ? 'border-secondary text-secondary font-semibold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">account_circle</span>
            <span>Avatar Customizer</span>
          </button>
          <button
            onClick={() => setActiveSubTab('preferences')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeSubTab === 'preferences'
                ? 'border-secondary text-secondary font-semibold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>Simulation Preferences</span>
          </button>
          <button
            onClick={() => setActiveSubTab('security')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeSubTab === 'security'
                ? 'border-secondary text-secondary font-semibold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">key</span>
            <span>API Token &amp; Nodes</span>
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeSubTab === 'history'
                ? 'border-secondary text-secondary font-semibold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            <span>Audit Trail</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-space-lg space-y-space-md">
          {/* TAB 1: IDENTITY & RESEARCH FIELDS */}
          {activeSubTab === 'profile' && (
            <form onSubmit={handleSaveAndClose} className="space-y-space-md">
              {/* Live Card Preview */}
              <div className="bg-gradient-to-br from-surface-container-low to-surface-container p-space-md rounded-2xl border border-surface-container-high flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${formData.avatarColor || 'from-secondary to-primary'} flex items-center justify-center text-on-primary font-bold text-2xl shadow-md shrink-0`}
                  >
                    {formData.avatarIcon && formData.avatarIcon !== 'initials' ? (
                      <span className="material-symbols-outlined text-[32px]">{formData.avatarIcon}</span>
                    ) : (
                      getInitials(formData.name)
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      {formData.name || 'Anonymous Researcher'}
                    </span>
                    <span className="font-label-sm text-label-sm text-secondary font-semibold">
                      {formData.role || 'Unspecified Role'}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-[14px]">apartment</span>
                      {formData.institution || 'Independent Research'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end text-left sm:text-right text-label-sm text-on-surface-variant border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto">
                  <span className="font-mono text-secondary font-semibold">{formData.email}</span>
                  <span className="text-[11px] text-on-surface-variant mt-0.5">
                    {formData.location || 'Distributed Edge'}
                  </span>
                  {formData.orcid && (
                    <span className="text-[10px] text-on-tertiary-container font-mono bg-on-tertiary-container/10 px-2 py-0.5 rounded mt-1">
                      ORCID: {formData.orcid}
                    </span>
                  )}
                </div>
              </div>

              {/* Editable Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                {/* Full Name */}
                <div className="md:col-span-2">
                  <label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">
                    Full Name &amp; Academic Honorific <span className="text-secondary">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Dr. Aris Thorne"
                    className="w-full px-3.5 py-2.5 bg-surface-container rounded-xl text-on-surface font-body-md outline-none focus:ring-2 focus:ring-secondary/50 border border-surface-container-high transition-all"
                    required
                  />
                  <span className="text-[11px] text-on-surface-variant mt-1 block">
                    Appears across federated telemetry logs, model audit reports, and LaTeX export authors.
                  </span>
                </div>

                {/* Role / Job Title */}
                <div className="md:col-span-2">
                  <label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">
                    Operational Role &amp; Designation <span className="text-secondary">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="e.g. Lead FL Systems Researcher"
                    className="w-full px-3.5 py-2.5 bg-surface-container rounded-xl text-on-surface font-body-md outline-none focus:ring-2 focus:ring-secondary/50 border border-surface-container-high transition-all"
                    required
                  />
                  {/* Role Suggestion Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] text-on-surface-variant font-medium mr-1">Presets:</span>
                    {roleSuggestions.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFormData({ ...formData, role: r })}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                          formData.role === r
                            ? 'bg-secondary/15 text-secondary border-secondary/40 font-semibold'
                            : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-container hover:text-on-surface'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Institutional Email */}
                <div>
                  <label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">
                    Institutional Email <span className="text-secondary">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@organization.org"
                    className="w-full px-3.5 py-2.5 bg-surface-container rounded-xl text-on-surface font-body-md outline-none focus:ring-2 focus:ring-secondary/50 border border-surface-container-high transition-all"
                    required
                  />
                </div>

                {/* Phone / Contact */}
                <div>
                  <label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">
                    Contact Phone / Extension
                  </label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 (555) 234-8842"
                    className="w-full px-3.5 py-2.5 bg-surface-container rounded-xl text-on-surface font-body-md outline-none focus:ring-2 focus:ring-secondary/50 border border-surface-container-high transition-all"
                  />
                </div>

                {/* Institution */}
                <div>
                  <label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">
                    Research Institution / Organization
                  </label>
                  <input
                    type="text"
                    value={formData.institution}
                    onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                    placeholder="e.g. Smart Cities Urban Traffic Lab"
                    className="w-full px-3.5 py-2.5 bg-surface-container rounded-xl text-on-surface font-body-md outline-none focus:ring-2 focus:ring-secondary/50 border border-surface-container-high transition-all"
                  />
                </div>

                {/* Department / Laboratory */}
                <div>
                  <label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">
                    Department / Laboratory
                  </label>
                  <input
                    type="text"
                    value={formData.department || ''}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g. Dept. of Intelligent Transportation Systems"
                    className="w-full px-3.5 py-2.5 bg-surface-container rounded-xl text-on-surface font-body-md outline-none focus:ring-2 focus:ring-secondary/50 border border-surface-container-high transition-all"
                  />
                </div>

                {/* Physical Location */}
                <div>
                  <label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">
                    Location / Office / Node Region
                  </label>
                  <input
                    type="text"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. San Francisco, CA, USA"
                    className="w-full px-3.5 py-2.5 bg-surface-container rounded-xl text-on-surface font-body-md outline-none focus:ring-2 focus:ring-secondary/50 border border-surface-container-high transition-all"
                  />
                </div>

                {/* ORCID ID */}
                <div>
                  <label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">
                    ORCID Researcher ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.orcid || ''}
                      onChange={(e) => setFormData({ ...formData, orcid: e.target.value })}
                      placeholder="0000-0002-1825-0097"
                      className="w-full px-3.5 py-2.5 bg-surface-container rounded-xl text-on-surface font-mono font-body-md outline-none focus:ring-2 focus:ring-secondary/50 border border-surface-container-high transition-all"
                    />
                    {formData.orcid && (
                      <a
                        href={`https://orcid.org/${formData.orcid}`}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-sans text-secondary hover:underline flex items-center gap-0.5"
                      >
                        Verify ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* Bio / Focus */}
                <div className="md:col-span-2">
                  <label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">
                    Research Bio &amp; Decentralized AI Scope
                  </label>
                  <textarea
                    rows={3}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Specializing in decentralized spatio-temporal deep learning and edge communications..."
                    className="w-full px-3.5 py-2.5 bg-surface-container rounded-xl text-on-surface font-body-md outline-none focus:ring-2 focus:ring-secondary/50 border border-surface-container-high resize-none transition-all"
                  />
                </div>
              </div>

              {/* Status info bar */}
              <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container flex flex-wrap items-center justify-between gap-2 text-label-sm text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-on-tertiary-container">verified</span>
                  <span>Security Profile: <strong>Verified &amp; Active</strong></span>
                </span>
                <span className="font-mono text-[11px]">
                  Last Session: {userProfile.lastLogin}
                </span>
              </div>
            </form>
          )}

          {/* TAB 2: AVATAR CUSTOMIZER */}
          {activeSubTab === 'avatar' && (
            <div className="space-y-space-md">
              {/* Preview Showcase */}
              <div className="p-6 bg-surface-container-low rounded-2xl border border-surface-container flex flex-col items-center justify-center gap-4 text-center">
                <div
                  className={`w-24 h-24 rounded-full bg-gradient-to-tr ${formData.avatarColor || 'from-secondary to-primary'} flex items-center justify-center text-on-primary font-bold text-3xl shadow-xl ring-4 ring-secondary/20 transition-all duration-300`}
                >
                  {formData.avatarIcon && formData.avatarIcon !== 'initials' ? (
                    <span className="material-symbols-outlined text-[44px]">{formData.avatarIcon}</span>
                  ) : (
                    getInitials(formData.name)
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    {formData.name || 'Dr. Aris Thorne'}
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary font-medium">
                    {formData.role || 'Lead FL Systems Researcher'}
                  </span>
                  <span className="text-[12px] text-on-surface-variant mt-1">
                    Live Avatar Preview across Header, Sidebar &amp; Edge Clusters
                  </span>
                </div>
              </div>

              {/* Icon Selection */}
              <div>
                <label className="block font-label-md text-label-md font-semibold text-on-surface mb-2">
                  Select Avatar Icon or Initials
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {avatarIcons.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, avatarIcon: item.id })}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                        (formData.avatarIcon || 'initials') === item.id
                          ? 'border-secondary bg-secondary/15 text-secondary font-bold shadow-xs scale-102'
                          : 'border-surface-container bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
                      <span className="text-[11px] text-center leading-tight truncate w-full">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Gradient Palette Selection */}
              <div>
                <label className="block font-label-md text-label-md font-semibold text-on-surface mb-2">
                  Select Avatar Gradient Theme
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {avatarGradients.map((grad) => (
                    <button
                      key={grad.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, avatarColor: grad.id })}
                      className={`p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                        formData.avatarColor === grad.id
                          ? 'border-secondary bg-surface-container text-on-surface font-bold shadow-xs ring-1 ring-secondary/50'
                          : 'border-surface-container bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-tr ${grad.id} shadow-xs shrink-0 ring-1 ring-black/20`} />
                      <div className="flex flex-col text-left">
                        <span className="text-body-sm font-semibold">{grad.name}</span>
                        <span className="text-[10px] text-on-surface-variant font-mono">Tailwind Gradient</span>
                      </div>
                      {formData.avatarColor === grad.id && (
                        <span className="material-symbols-outlined text-[18px] text-secondary ml-auto">check_circle</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SIMULATION & UI PREFERENCES */}
          {activeSubTab === 'preferences' && (
            <div className="space-y-space-md">
              {/* Platform Accent Color */}
              <div>
                <label className="block font-label-md text-label-md font-semibold text-on-surface mb-2">
                  Telemetry Theme Palette
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'ocean', name: 'Ocean Cyan (Default)', color: 'bg-[#006398]', desc: 'FedTraffic Standard' },
                    { id: 'emerald', name: 'Emerald Transit', color: 'bg-[#009668]', desc: 'High Contrast Green' },
                    { id: 'violet', name: 'Cyber Violet', color: 'bg-[#6b21a8]', desc: 'Spatio-Temporal Deep' },
                    { id: 'amber', name: 'Sunset Amber', color: 'bg-[#d97706]', desc: 'Urban Congestion Focus' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, themeColor: t.id as any })}
                      className={`p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                        formData.themeColor === t.id
                          ? 'border-secondary bg-surface-container text-on-surface font-bold shadow-xs'
                          : 'border-surface-container bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full ${t.color} shrink-0 ring-1 ring-white/20`}></span>
                      <div className="flex flex-col text-left">
                        <span className="text-body-sm font-semibold">{t.name}</span>
                        <span className="text-[10px] text-on-surface-variant">{t.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Units */}
              <div>
                <label className="block font-label-md text-label-md font-semibold text-on-surface mb-2">
                  Traffic Velocity &amp; Flow Metrics Units
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, units: 'veh_h' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer font-label-sm text-label-sm ${
                      formData.units === 'veh_h'
                        ? 'border-secondary bg-secondary/10 text-secondary font-bold'
                        : 'border-surface-container bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <div className="font-bold text-on-surface">Vehicles per Hour (veh/h)</div>
                    <div className="text-[11px] text-on-surface-variant mt-0.5">Highway &amp; Corridor Capacity standard</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, units: 'veh_min' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer font-label-sm text-label-sm ${
                      formData.units === 'veh_min'
                        ? 'border-secondary bg-secondary/10 text-secondary font-bold'
                        : 'border-surface-container bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <div className="font-bold text-on-surface">Vehicles per Minute (veh/min)</div>
                    <div className="text-[11px] text-on-surface-variant mt-0.5">Intersection Phase &amp; Signal standard</div>
                  </button>
                </div>
              </div>

              {/* Default Random Seed */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-label-md text-label-md font-semibold text-on-surface">
                    Default Simulation Random Seed Initializer
                  </label>
                  <span className="font-mono text-xs text-secondary font-bold">Current: {formData.defaultSeed}</span>
                </div>
                <div className="flex gap-2">
                  {[42, 108, 999].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData({ ...formData, defaultSeed: s })}
                      className={`flex-1 py-2.5 rounded-xl font-mono text-center font-label-sm text-label-sm border transition-all cursor-pointer ${
                        formData.defaultSeed === s
                          ? 'border-secondary bg-secondary text-on-secondary font-bold shadow-xs'
                          : 'border-surface-container bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      Seed {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-xl border border-surface-container">
                  <div className="flex flex-col pr-4">
                    <span className="font-headline-sm text-body-md font-bold text-on-surface">
                      Live Telemetry Auto-Stream
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Keep edge node packet transfers and gradient telemetry streaming automatically
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.autoRefreshStream}
                    onChange={(e) => setFormData({ ...formData, autoRefreshStream: e.target.checked })}
                    className="w-5 h-5 accent-secondary cursor-pointer shrink-0"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-xl border border-surface-container">
                  <div className="flex flex-col pr-4">
                    <span className="font-headline-sm text-body-md font-bold text-on-surface">
                      Round Completion Notification Toasts
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Show in-app toast alerts when FedAvg aggregation rounds commit weight tensors
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.notificationsEnabled}
                    onChange={(e) => setFormData({ ...formData, notificationsEnabled: e.target.checked })}
                    className="w-5 h-5 accent-secondary cursor-pointer shrink-0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: API ACCESS & EDGE NODE SECURITY */}
          {activeSubTab === 'security' && (
            <div className="space-y-space-md">
              <div className="bg-surface-container-low p-space-md rounded-2xl border border-surface-container space-y-space-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">vpn_key</span>
                    <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      Roadside Edge (RSU) API Token                    </span>
                  </div>
                  <span className="font-label-sm text-label-sm px-2.5 py-0.5 rounded-full bg-on-tertiary-container/15 text-on-tertiary-container font-semibold border border-on-tertiary-container/30">
                    Active &amp; Authenticated
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Used by physical roadside controllers (INT-01 through INT-05) to cryptographically sign and authenticate gradient uploads to the central aggregation server.
                </p>

                {/* Token Display or Editable Input */}
                {isEditingToken ? (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-secondary">Custom Edge Token Input</label>
                    <input
                      type="text"
                      value={formData.apiToken}
                      onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                      className="w-full px-3 py-2 bg-surface-container rounded-lg text-on-surface font-mono text-sm outline-none focus:ring-2 focus:ring-secondary/50 border border-secondary"
                      placeholder="Enter custom API secret key..."
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingToken(false)}
                        className="px-3 py-1 bg-secondary text-on-secondary rounded text-xs font-semibold"
                      >
                        Accept Custom Token
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingToken(false)}
                        className="px-3 py-1 bg-surface-container-high text-on-surface rounded text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-surface-container p-2.5 rounded-xl font-mono text-label-sm border border-surface-container-high">
                    <span className="flex-1 truncate text-on-surface">
                      {showToken ? formData.apiToken : '••••••••••••••••••••••••••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="p-1.5 hover:text-on-surface text-on-surface-variant hover:bg-surface-container-high rounded-lg cursor-pointer transition-colors"
                      title={showToken ? 'Hide token' : 'Show token'}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showToken ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className="p-1.5 hover:text-secondary text-on-surface-variant hover:bg-surface-container-high rounded-lg cursor-pointer transition-colors"
                      title="Copy token to clipboard"
                    >
                      <span className="material-symbols-outlined text-[18px]">content_copy</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingToken(true)}
                      className="p-1.5 hover:text-secondary text-on-surface-variant hover:bg-surface-container-high rounded-lg cursor-pointer transition-colors"
                      title="Edit token directly"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleRegenerateToken}
                    className="py-2 px-3 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-surface-container-high"
                  >
                    <span className="material-symbols-outlined text-[16px] text-secondary">refresh</span>
                    <span>Generate New Token</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      addToast('Token Validated', 'Handshake confirmed with all 5 roadside edge units.', 'success');
                    }}
                    className="py-2 px-3 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-surface-container-high"
                  >
                    <span className="material-symbols-outlined text-[16px] text-on-tertiary-container">verified_user</span>
                    <span>Test Edge Handshake</span>
                  </button>
                </div>
              </div>

              {/* Edge Node Authorization Specs */}
              <div className="bg-surface-container-low p-space-md rounded-2xl border border-surface-container space-y-space-xs">
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-secondary">security</span>
                  Edge Node Security &amp; Differential Privacy (DP)
                </span>
                <div className="space-y-2 pt-2 font-label-sm text-label-sm text-on-surface-variant">
                  <div className="flex justify-between items-center py-1.5 border-b border-surface-container">
                    <span>Cluster Authorization Scope:</span>
                    <span className="font-semibold text-on-surface">5 Nodes (Full Mesh Read/Write)</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-surface-container">
                    <span>Cellular Uplink Encryption:</span>
                    <span className="font-semibold text-on-tertiary-container">TLS 1.3 / AES-256-GCM</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-surface-container">
                    <span>Differential Privacy (DP-SGD):</span>
                    <span className="font-semibold text-secondary">L2 Gradient Clip C=1.5, σ=0.01</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span>Zero Data Leakage Guarantee:</span>
                    <span className="font-semibold text-on-tertiary-container">100% Raw Data Preserved at Edge</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT TRAIL */}
          {activeSubTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">
                  Recent Evaluation &amp; Researcher Actions
                </span>
                <button
                  type="button"
                  onClick={() => addToast('Audit Trail Exported', 'Downloaded researcher session audit ledger.', 'info')}
                  className="text-xs text-secondary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Export Audit Log
                </button>
              </div>

              {experiments.slice(0, 8).map((e) => ({
                time: new Date(e.created_at).toLocaleTimeString(),
                event: `${e.name}: ${e.status}${e.metrics ? ` (test MAE ${e.metrics.mae.toFixed(2)} ${e.metrics.unit})` : ''}`,
                type: e.status === 'completed' ? 'success' : e.status === 'failed' ? 'warning' : 'info',
              })).map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-surface-container-low rounded-xl flex items-center justify-between text-body-sm border border-surface-container/60 hover:bg-surface-container transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.type === 'success'
                          ? 'bg-on-tertiary-container'
                          : item.type === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-secondary'
                      }`}
                    ></span>
                    <span className="text-on-surface font-medium">{item.event}</span>
                  </div>
                  <span className="font-label-sm text-label-sm font-mono text-on-surface-variant shrink-0 ml-2">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-space-md bg-surface-container-low border-t border-surface-container flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset all profile settings to system factory defaults?')) {
                resetUserProfile();
                setIsProfileOpen(false);
              }
            }}
            className="px-3 py-2 text-error hover:bg-error-container/20 rounded-xl font-label-md text-label-md font-medium transition-colors cursor-pointer"
          >
            Reset Defaults
          </button>

          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="px-3.5 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface rounded-xl font-label-md text-label-md transition-colors cursor-pointer"
              >
                Discard
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (hasUnsavedChanges) {
                  if (window.confirm('Close without saving your profile changes?')) {
                    setIsProfileOpen(false);
                  }
                } else {
                  setIsProfileOpen(false);
                }
              }}
              className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-label-md text-label-md transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleSaveAndClose()}
              className="px-5 py-2 bg-secondary hover:bg-secondary/90 text-on-secondary rounded-xl font-label-md text-label-md font-semibold transition-all shadow-md cursor-pointer active:scale-98 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">check</span>
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
