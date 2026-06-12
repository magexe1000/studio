import React, { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStudioPreferences } from '../hooks/useStudioPreferences';

interface SidebarContextType {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

export function SidebarProvider({
  children,
  defaultOpen = true,
  className = '',
  style = {},
  ...props
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('studio:sidebarOpen');
      return saved !== null ? saved === 'true' : defaultOpen;
    } catch {
      return defaultOpen;
    }
  });

  const isMobile = false; // Strictly desktop web layout helper

  const toggleSidebar = () => {
    setOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('studio:sidebarOpen', String(next));
      } catch {}
      return next;
    });
  };

  const state = open ? 'expanded' : 'collapsed';
  const width = open ? '240px' : '0px';

  return (
    <SidebarContext.Provider value={{ state, open, setOpen, isMobile, toggleSidebar }}>
      <div
        className={`flex w-full h-full min-h-screen overflow-hidden ${className}`}
        style={{
          '--sidebar-width': '240px',
          '--sidebar-width-icon': '0px',
          '--sidebar-current-width': width,
          ...style,
        } as React.CSSProperties}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({
  children,
  className = '',
  style = {},
  shouldHideSidebar = false,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  shouldHideSidebar?: boolean;
}) {
  const { open } = useSidebar();
  const { preferences } = useStudioPreferences();
  const isReduced = preferences.reduceMotion;

  const targetWidth = open ? '240px' : '0px';
  const targetMargin = open ? '12px' : '0px';
  const targetBorderColor = open ? 'rgba(128,128,128,0.15)' : 'rgba(128,128,128,0)';
  const targetBorderWidth = open ? '1px' : '0px';

  const duration = isReduced ? 0 : 0.22;

  return (
    <motion.aside
      className={`flex flex-col select-none flex-shrink-0 relative ${className}`}
      animate={{
        width: targetWidth,
        margin: targetMargin,
        borderColor: targetBorderColor,
        borderWidth: targetBorderWidth,
      }}
      transition={{
        width: {
          duration,
          ease: [0.22, 1, 0.36, 1],
        },
        margin: {
          duration,
          ease: [0.22, 1, 0.36, 1],
        },
        borderColor: {
          duration,
          ease: 'linear',
        },
        borderWidth: {
          duration,
          ease: 'linear',
        }
      }}
      style={{
        height: open ? 'calc(100vh - 24px)' : '100vh',
        borderRadius: open ? '16px' : '0px',
        borderStyle: 'solid',
        background: 'rgba(15, 15, 15, 0.70)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        boxShadow: open ? '0 10px 30px rgba(0,0,0,0.5)' : 'none',
        boxSizing: 'border-box',
        overflow: 'hidden',
        willChange: 'width, margin, border-color, border-width',
        zIndex: 40,
        ...style,
      }}
      {...props}
    >
      <motion.div
        animate={{
          opacity: open ? 1 : 0,
        }}
        transition={{
          duration: isReduced ? 0 : (open ? 0.18 : 0.08),
          ease: 'easeInOut',
        }}
        style={{
          width: '240px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {children}
      </motion.div>
    </motion.aside>
  );
}

export function SidebarHeader({
  children,
  className = '',
  style = {},
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`py-3 flex-shrink-0 flex items-center justify-start px-4 border-b border-[rgba(128,128,128,0.06)] ${className}`}
      style={{ height: '64px', boxSizing: 'border-box', ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

export function SidebarContent({
  children,
  className = '',
  style = {},
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-2 py-3 space-y-4 ${className}`}
      style={{ ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

export function SidebarGroup({
  children,
  className = '',
  style = {},
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`space-y-1 ${className}`} style={style} {...props}>
      {children}
    </div>
  );
}

export function SidebarGroupLabel({
  children,
  className = '',
  style = {},
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { open } = useSidebar();
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 0.45, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.15 }}
          className={`px-3 py-1 text-[10px] font-extrabold tracking-wider uppercase text-[var(--c-text-primary)] ${className}`}
          style={{ letterSpacing: '0.12em', fontFamily: 'Manrope, sans-serif', ...style }}
          {...props}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SidebarMenu({
  children,
  className = '',
  style = {},
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <ul className={`space-y-0.5 p-0 m-0 list-none ${className}`} style={style} {...props}>
      {children}
    </ul>
  );
}

export function SidebarMenuItem({
  children,
  className = '',
  style = {},
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <li className={className} style={style} {...props}>
      {children}
    </li>
  );
}

export function SidebarMenuButton({
  children,
  active,
  onClick,
  className = '',
  style = {},
  tooltip,
  ...props
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  style?: React.CSSProperties;
  tooltip?: string;
}) {
  const { open } = useSidebar();

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-xl border-none text-left cursor-pointer transition-all duration-150 relative group hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))] ${className}`}
      title={!open ? tooltip || undefined : undefined}
      style={{
        background: active ? 'var(--sidebar-active-bg, rgba(255, 255, 255, 0.07))' : 'transparent',
        color: active ? 'var(--c-text-primary)' : 'var(--c-text-secondary)',
        fontFamily: 'Manrope, sans-serif',
        fontWeight: active ? 700 : 500,
        fontSize: '13px',
        boxSizing: 'border-box',
        outline: 'none',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      {...props}
    >
      {active && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className="absolute left-1 w-1 h-5 rounded-full"
          style={{
            background: 'linear-gradient(135deg, var(--studio-accent-from, #679cff), var(--studio-accent-to, #007aff))',
          }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      {children}
    </button>
  );
}

export function SidebarFooter({
  children,
  className = '',
  style = {},
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`p-3 border-t border-[rgba(128,128,128,0.06)] flex-shrink-0 ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export function SidebarRail({
  className = '',
  style = {},
  ...props
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const { toggleSidebar } = useSidebar();
  return (
    <div
      onClick={toggleSidebar}
      className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[rgba(128,128,128,0.15)] transition-colors duration-150 z-50 ${className}`}
      style={style}
      {...props}
    />
  );
}

export function SidebarInset({
  children,
  className = '',
  style = {},
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <main className={`flex-1 h-screen overflow-hidden relative ${className}`} style={style} {...props}>
      {children}
    </main>
  );
}

export function SidebarTrigger({
  className = '',
  style = {},
  ...props
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const { toggleSidebar, open } = useSidebar();
  return (
    <button
      onClick={toggleSidebar}
      className={`p-2 rounded-lg border border-[rgba(128,128,128,0.15)] bg-transparent text-[var(--c-text-primary)] cursor-pointer flex items-center justify-center transition-colors hover:bg-[rgba(255,255,255,0.06)] ${className}`}
      style={{ outline: 'none', ...style }}
      {...props}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
        {open ? 'menu_open' : 'menu'}
      </span>
    </button>
  );
}
