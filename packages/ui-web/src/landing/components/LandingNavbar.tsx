import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { StudioLogo } from '../../components/ChordexLogo';
import { useStudioPreferences } from '../../hooks/useStudioPreferences';

interface LandingNavbarProps {
  navigateTo: (path: string) => void;
}

export default function LandingNavbar({ navigateTo }: LandingNavbarProps) {
  const { preferences } = useStudioPreferences();
  const isReduced = preferences.reduceMotion;
  const [activeSection, setActiveSection] = useState<string>('');

  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const sectionIds = ['suite', 'showcase', 'features', 'downloads'];
    
    const handleScroll = () => {
      const scrollPos = window.scrollY + 200; // offset for navbar height
      
      // If at the top of the page, highlight nothing
      if (window.scrollY < 100) {
        setActiveSection('');
        return;
      }
      
      // Find current section
      let current = '';
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            current = id;
            break;
          }
        }
      }
      
      // If we are at the bottom of the page, default to downloads
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50) {
        current = 'downloads';
      }
      
      if (current) {
        setActiveSection(current);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { id: 'suite', label: 'Suite' },
    { id: 'showcase', label: 'Showcase' },
    { id: 'features', label: 'Features' },
    { id: 'downloads', label: 'Downloads' }
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-900 bg-[#030303]/80 backdrop-blur-md transition-all duration-300 landing-font-heading">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-white flex-shrink-0">
            <StudioLogo size={28} />
          </div>
          <span 
            className="font-extrabold text-base tracking-tight text-white"
            style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.02em' }}
          >
            Studio
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400 bg-zinc-950/40 border border-zinc-900/40 p-1 rounded-full relative">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a 
                key={item.id}
                href={`#${item.id}`} 
                onClick={(e) => handleScrollTo(e, item.id)}
                className={`relative px-4 py-1.5 rounded-full transition-colors duration-200 ${
                  isActive ? 'text-white' : 'hover:text-zinc-200'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="activeLandingTab"
                    className="absolute inset-0 bg-zinc-800/40 border border-zinc-800/60 rounded-full -z-10"
                    transition={isReduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                {item.label}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
