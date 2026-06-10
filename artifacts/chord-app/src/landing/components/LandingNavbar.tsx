import React from 'react';
import { StudioLogo } from '../../components/ChordexLogo';

interface LandingNavbarProps {
  navigateTo: (path: string) => void;
}

export default function LandingNavbar({ navigateTo }: LandingNavbarProps) {
  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

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

        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <a 
            href="#suite" 
            onClick={(e) => handleScrollTo(e, 'suite')}
            className="hover:text-white transition-colors duration-200"
          >
            Suite
          </a>
          <a 
            href="#showcase" 
            onClick={(e) => handleScrollTo(e, 'showcase')}
            className="hover:text-white transition-colors duration-200"
          >
            Showcase
          </a>
          <a 
            href="#features" 
            onClick={(e) => handleScrollTo(e, 'features')}
            className="hover:text-white transition-colors duration-200"
          >
            Features
          </a>
          <a 
            href="#downloads" 
            onClick={(e) => handleScrollTo(e, 'downloads')}
            className="hover:text-white transition-colors duration-200"
          >
            Downloads
          </a>
        </nav>

        <button 
          onClick={() => {
            sessionStorage.setItem('studio:entered_from_landing', 'true');
            navigateTo('/app');
          }}
          className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#030303] bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-all duration-200"
        >
          Use Studio Web
        </button>
      </div>
    </header>
  );
}
