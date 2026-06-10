import React from 'react';

// 1. WebAppShell
export function WebAppShell({ 
  children, 
  className = '', 
  style 
}: { 
  children: React.ReactNode; 
  className?: string; 
  style?: React.CSSProperties; 
}) {
  return (
    <div 
      className={`w-full h-full bg-[#050505] text-[#f2f1ef] flex flex-col overflow-hidden font-sans select-none border border-zinc-900/10 rounded-xl ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

// 2. WebWorkspace
export function WebWorkspace({ 
  children, 
  className = '', 
  style 
}: { 
  children: React.ReactNode; 
  className?: string; 
  style?: React.CSSProperties; 
}) {
  return (
    <div 
      className={`flex-1 flex overflow-hidden bg-[#050505] relative ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

// 3. WebPanel
export function WebPanel({ 
  children, 
  className = '', 
  style, 
  borderRight = false, 
  width 
}: { 
  children: React.ReactNode; 
  className?: string; 
  style?: React.CSSProperties; 
  borderRight?: boolean; 
  width?: string; 
}) {
  return (
    <div 
      className={`flex flex-col overflow-hidden bg-[#050505] ${borderRight ? 'border-r border-zinc-900/60' : ''} ${className}`}
      style={{ width: width || 'auto', ...style }}
    >
      {children}
    </div>
  );
}

// 4. WebSectionHeader
export function WebSectionHeader({ 
  title, 
  children 
}: { 
  title: string; 
  children?: React.ReactNode; 
}) {
  return (
    <div className="h-9 border-b border-zinc-900/80 px-4 flex items-center justify-between bg-[#080808]/40 flex-shrink-0 select-none">
      <span className="font-extrabold text-[8.5px] uppercase text-white tracking-wide" style={{ letterSpacing: '0.08em' }}>
        {title}
      </span>
      {children}
    </div>
  );
}

// 5. WebCard
export function WebCard({ 
  children, 
  className = '', 
  style, 
  onClick 
}: { 
  children: React.ReactNode; 
  className?: string; 
  style?: React.CSSProperties; 
  onClick?: () => void; 
}) {
  if (onClick) {
    return (
      <button 
        onClick={onClick}
        className={`block w-full rounded-xl border border-zinc-900 bg-zinc-950/40 p-3 hover:border-zinc-800 transition-all text-left cursor-pointer outline-none ${className}`}
        style={style}
      >
        {children}
      </button>
    );
  }
  return (
    <div 
      className={`block w-full rounded-xl border border-zinc-900 bg-zinc-950/40 p-3 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

// 6. WebListRow
export function WebListRow({ 
  children, 
  isActive = false, 
  onClick, 
  className = '', 
  style 
}: { 
  children: React.ReactNode; 
  isActive?: boolean; 
  onClick?: () => void; 
  className?: string; 
  style?: React.CSSProperties; 
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2 rounded-lg text-left text-xs font-semibold truncate transition-all outline-none border-none cursor-pointer ${
        isActive 
          ? 'bg-zinc-100 text-[#030303] font-bold shadow-md shadow-white/5' 
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
      } ${className}`}
      style={style}
    >
      {children}
    </button>
  );
}

// 7. WebEmptyState
export function WebEmptyState({ 
  message, 
  icon 
}: { 
  message: string; 
  icon?: string; 
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
      {icon && (
        <span className="material-symbols-outlined text-zinc-600 mb-2" style={{ fontSize: 32 }}>
          {icon}
        </span>
      )}
      <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
        {message}
      </p>
    </div>
  );
}

// 8. WebToolbarButton
export function WebToolbarButton({ 
  children, 
  onClick, 
  active = false, 
  className = '', 
  style 
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  active?: boolean; 
  className?: string; 
  style?: React.CSSProperties; 
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition-all border-none outline-none cursor-pointer ${
        active 
          ? 'bg-zinc-800 text-white' 
          : 'text-zinc-500 hover:text-zinc-300 bg-transparent'
      } ${className}`}
      style={style}
    >
      {children}
    </button>
  );
}

// 9. WebSettingsSection
export function WebSettingsSection({ 
  title, 
  children 
}: { 
  title: string; 
  children: React.ReactNode; 
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[9.5px] font-extrabold tracking-wider text-zinc-500 uppercase px-1" style={{ letterSpacing: '0.06em' }}>
        {title}
      </span>
      <div className="border border-zinc-900 bg-zinc-950/20 rounded-xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// 10. WebPreferenceRow
export function WebPreferenceRow({ 
  label, 
  desc, 
  children 
}: { 
  label: string; 
  desc?: string; 
  children: React.ReactNode; 
}) {
  return (
    <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-900/40 last:border-none">
      <div className="flex-1 pr-4">
        <div className="text-xs font-bold text-zinc-300">{label}</div>
        {desc && <div className="text-[10px] text-zinc-500 leading-snug mt-0.5">{desc}</div>}
      </div>
      <div className="flex-shrink-0">
        {children}
      </div>
    </div>
  );
}

// 11. WebAppFrame
export function WebAppFrame({ 
  children,
  className = '',
  style
}: { 
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div 
      className={`w-full h-full bg-black text-[#f4f4f5] flex flex-col overflow-hidden border border-zinc-900 rounded-xl ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

// 12. WebList
export function WebList({ 
  children,
  className = '',
  style
}: { 
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div 
      className={`flex flex-col gap-0.5 p-1 overflow-y-auto no-scrollbar ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

// 13. WebToolbar
export function WebToolbar({ 
  children,
  className = '',
  style
}: { 
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div 
      className={`h-12 border-b border-zinc-900/80 px-4 flex items-center justify-between bg-zinc-950/20 flex-shrink-0 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

// 14. WebButton
export function WebButton({ 
  children,
  onClick,
  variant = 'secondary',
  className = '',
  style,
  disabled
}: { 
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  const baseClass = "px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all border outline-none cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed";
  const variantClass = variant === 'primary' 
    ? "bg-zinc-100 text-black border-transparent hover:bg-zinc-200" 
    : variant === 'danger'
      ? "bg-red-950/20 text-red-400 border-red-900/40 hover:bg-red-950/40 hover:border-red-900"
      : "bg-transparent text-zinc-300 border-zinc-900 hover:border-zinc-800 hover:text-white";
  return (
    <button
      onClick={onClick}
      className={`${baseClass} ${variantClass} ${className}`}
      style={style}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

// 15. WebIconButton
export function WebIconButton({ 
  icon,
  onClick,
  active = false,
  className = '',
  style,
  title,
  disabled
}: { 
  icon: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer border outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
        active 
          ? 'bg-zinc-800 text-white border-zinc-700' 
          : 'bg-transparent text-zinc-400 border-transparent hover:text-zinc-200 hover:border-zinc-900'
      } ${className}`}
      style={style}
      disabled={disabled}
    >
      <span className="material-symbols-outlined text-[17px]">{icon}</span>
    </button>
  );
}

