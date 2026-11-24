import React, { useMemo, useState } from 'react';
import {
  AppearancePortalRole,
  PageAppearanceSettings,
} from '../../types';
import {
  getAppearanceElementsForPortal,
  getAppearanceVisibilitySummary,
  isPageElementVisible,
  PORTAL_APPEARANCE_TITLE_AR,
  resetPageAppearanceSettings,
  setAllPageElementsVisibility,
  setAppearanceCompactMode,
  togglePageElementVisibility,
} from '../../utils/appearanceSettings';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  LayoutGrid,
  Minimize2,
  RotateCcw,
  Search,
  Sliders,
  X,
} from 'lucide-react';

interface AppearanceControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  portal: AppearancePortalRole;
  settings: PageAppearanceSettings;
  onChange: (nextSettings: PageAppearanceSettings, options?: { silent?: boolean }) => void;
}

export const AppearanceControlModal: React.FC<AppearanceControlModalProps> = ({
  isOpen,
  onClose,
  portal,
  settings,
  onChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const elements = useMemo(
    () => getAppearanceElementsForPortal(portal),
    [portal]
  );

  const summary = useMemo(
    () => getAppearanceVisibilitySummary(portal, settings),
    [portal, settings]
  );

  const filteredElements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return elements;
    return elements.filter(
      el =>
        el.labelAr.toLowerCase().includes(q) ||
        el.descriptionAr.toLowerCase().includes(q) ||
        el.categoryAr.toLowerCase().includes(q)
    );
  }, [elements, searchQuery]);

  const groupedElements = useMemo(() => {
    const groups: Array<{ category: string; items: typeof filteredElements }> = [];
    const indexByCategory = new Map<string, number>();
    for (const item of filteredElements) {
      const idx = indexByCategory.get(item.categoryAr);
      if (idx === undefined) {
        indexByCategory.set(item.categoryAr, groups.length);
        groups.push({ category: item.categoryAr, items: [item] });
      } else {
        groups[idx] = {
          ...groups[idx],
          items: [...groups[idx].items, item],
        };
      }
    }
    return groups;
  }, [filteredElements]);

  if (!isOpen) return null;

  const isPurpleAccent = portal === 'super_admin';
  const accentTextClass = isPurpleAccent ? 'text-purple-400' : 'text-amber-400';
  const accentBadgeClass = isPurpleAccent
    ? 'bg-purple-500/15 text-purple-300 border-purple-500/35'
    : 'bg-amber-500/15 text-amber-300 border-amber-500/35';
  const primaryButtonClass = isPurpleAccent
    ? 'bg-purple-500 hover:bg-purple-400 text-slate-950'
    : 'bg-amber-500 hover:bg-amber-400 text-slate-950';

  const handleToggleElement = (key: string) => {
    const next = togglePageElementVisibility(settings, key);
    onChange(next, { silent: true });
  };

  const handleShowAll = () => {
    const next = setAllPageElementsVisibility(portal, true, settings);
    onChange(next, { silent: false });
  };

  const handleHideAll = () => {
    const next = setAllPageElementsVisibility(portal, false, settings);
    onChange(next, { silent: false });
  };

  const handleReset = () => {
    const next = resetPageAppearanceSettings();
    onChange(next, { silent: false });
  };

  const handleToggleCompact = () => {
    const next = setAppearanceCompactMode(settings, !settings.compactMode);
    onChange(next, { silent: true });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appearance-control-modal-title"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden text-slate-100 text-xs my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950/80 border-b border-slate-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${
                isPurpleAccent
                  ? 'bg-purple-500/15 border-purple-500/35 text-purple-400'
                  : 'bg-amber-500/15 border-amber-500/35 text-amber-400'
              }`}
            >
              <Sliders className="w-5 h-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="appearance-control-modal-title"
                  className="font-bold text-sm sm:text-base text-white"
                >
                  لوحة التحكم بمظهر الصفحة وإخفاء/إظهار العناصر
                </h2>
                <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${accentBadgeClass}`}>
                  {PORTAL_APPEARANCE_TITLE_AR[portal]}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                تحكم مباشرة في العناصر والأقسام الظاهرة بصفحتك. يتم تطبيق التغييرات فوراً وحفظها في حسابك.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            aria-label="إغلاق لوحة المظهر"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary & Quick Controls */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-semibold text-slate-200">
                <LayoutGrid className={`w-3.5 h-3.5 ${accentTextClass}`} />
                <span>
                  المعروض حالياً:{' '}
                  <strong className="font-mono text-emerald-400 tabular-nums">{summary.visible}</strong>{' '}
                  من{' '}
                  <strong className="font-mono text-white tabular-nums">{summary.total}</strong> عنصر
                </span>
              </span>
              {summary.hidden > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] font-semibold text-rose-300">
                  <EyeOff className="w-3 h-3" />
                  <span>{summary.hidden} مخفي</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleShowAll}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>إظهار الكل</span>
              </button>

              <button
                type="button"
                onClick={handleHideAll}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
              >
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                <span>إخفاء الكل</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                <span>إعادة الافتراضي</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث عن عنصر أو قسم في صفحتك..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-slate-600 rounded-xl pr-9 pl-8 py-2 text-xs text-white placeholder-slate-500 outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  aria-label="مسح البحث"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Compact Mode Toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(settings.compactMode)}
              onClick={handleToggleCompact}
              className={`px-3 py-2 rounded-xl border text-[11px] font-bold flex items-center justify-between sm:justify-center gap-2 transition-colors cursor-pointer shrink-0 ${
                settings.compactMode
                  ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/40'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>تخطيط مضغوط</span>
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  settings.compactMode
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {settings.compactMode ? 'مفعل' : 'عادي'}
              </span>
            </button>
          </div>
        </div>

        {/* Scrollable Elements List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {groupedElements.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center text-slate-400">
              لا توجد عناصر مطابقة لعبارة البحث الحالية.
            </div>
          ) : (
            groupedElements.map(group => (
              <div key={group.category} className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
                  <span>{group.category}</span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {group.items.filter(i => isPageElementVisible(settings, i.key)).length}/{group.items.length} ظاهر
                  </span>
                </div>

                <div className="space-y-2">
                  {group.items.map(item => {
                    const visible = isPageElementVisible(settings, item.key);
                    return (
                      <div
                        key={item.key}
                        onClick={() => handleToggleElement(item.key)}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all cursor-pointer select-none ${
                          visible
                            ? 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                            : 'bg-slate-950/40 border-slate-800/60 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
                              visible
                                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                                : 'bg-slate-900 border-slate-700 text-slate-500'
                            }`}
                          >
                            {visible ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <EyeOff className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`font-bold text-xs ${
                                  visible ? 'text-white' : 'text-slate-400 line-through'
                                }`}
                              >
                                {item.labelAr}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                  visible
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-rose-500/10 text-rose-300 border-rose-500/25'
                                }`}
                              >
                                {visible ? 'ظاهر' : 'مخفي'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                              {item.descriptionAr}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={visible}
                          aria-label={`${visible ? 'إخفاء' : 'إظهار'} ${item.labelAr}`}
                          onClick={e => {
                            e.stopPropagation();
                            handleToggleElement(item.key);
                          }}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                            visible
                              ? 'bg-emerald-500 border-emerald-400'
                              : 'bg-slate-800 border-slate-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              visible ? '-translate-x-6' : '-translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>يبقى زر «مظهر الصفحة» متاحاً دائماً لاستعادة أي عنصر مخفي في أي وقت.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`px-5 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer shrink-0 ${primaryButtonClass}`}
          >
            تم وإغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
