import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useT } from '../lib/useT';
import { setVocalexBack } from './headerBack';

interface Tip {
  title: string;
  body: string;
}

interface Section {
  id: string;
  name: string;
  icon: string;
  color: string;
  tips: Tip[];
}

const SECTION_META = [
  { id: 'warmup', icon: 'local_fire_department', color: '#f59e0b', nameKey: 'sectionWarmup', tipKeys: ['tipWarmup1','tipWarmup2','tipWarmup3','tipWarmup4','tipWarmup5'] },
  { id: 'breath', icon: 'air', color: '#34d399', nameKey: 'sectionBreath', tipKeys: ['tipBreath1','tipBreath2','tipBreath3','tipBreath4','tipBreath5'] },
  { id: 'pitch', icon: 'music_note', color: '#007aff', nameKey: 'sectionPitch', tipKeys: ['tipPitch1','tipPitch2','tipPitch3','tipPitch4','tipPitch5'] },
  { id: 'resonance', icon: 'record_voice_over', color: '#a78bfa', nameKey: 'sectionResonance', tipKeys: ['tipResonance1','tipResonance2','tipResonance3','tipResonance4','tipResonance5'] },
  { id: 'range', icon: 'expand', color: '#ec4899', nameKey: 'sectionRange', tipKeys: ['tipRange1','tipRange2','tipRange3','tipRange4','tipRange5'] },
  { id: 'performance', icon: 'theater_comedy', color: '#ef4444', nameKey: 'sectionPerformance', tipKeys: ['tipPerformance1','tipPerformance2','tipPerformance3','tipPerformance4','tipPerformance5'] },
  { id: 'harmonies', icon: 'stacked_line_chart', color: '#10b981', nameKey: 'sectionHarmonies', tipKeys: ['tipHarmonies1','tipHarmonies2','tipHarmonies3','tipHarmonies4','tipHarmonies5','tipHarmonies6','tipHarmonies7','tipHarmonies8','tipHarmonies9','tipHarmonies10'] },
  { id: 'health', icon: 'health_and_safety', color: '#06b6d4', nameKey: 'sectionHealth', tipKeys: ['tipHealth1','tipHealth2','tipHealth3','tipHealth4','tipHealth5'] },
] as const;

function buildSections(v: Record<string, any>): Section[] {
  return SECTION_META.map(m => ({
    id: m.id,
    name: v[m.nameKey] ?? m.id,
    icon: m.icon,
    color: m.color,
    tips: m.tipKeys.map(k => ({
      title: v[k + 'Title'] ?? k,
      body: v[k + 'Body'] ?? '',
    })),
  }));
}

const ANIM_CSS = `
@keyframes pp-fade-up {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pp-slide-in {
  from { opacity: 0; transform: translateX(40px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes pp-slide-out {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(-40px); }
}
@keyframes pp-expand {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

function useAnimStyle() {
  const injected = useRef(false);
  useEffect(() => {
    if (injected.current) return;
    injected.current = true;
    const s = document.createElement('style');
    s.textContent = ANIM_CSS;
    document.head.appendChild(s);
    return () => { s.remove(); injected.current = false; };
  }, []);
}

function TipCard({ tip, color, index }: { tip: Tip; color: string; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyH, setBodyH] = useState(0);

  useEffect(() => {
    if (expanded && bodyRef.current) {
      setBodyH(bodyRef.current.scrollHeight);
    }
  }, [expanded]);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: 'var(--vx-card)',
        borderRadius: 16,
        padding: '18px 20px',
        cursor: 'pointer',
        border: `1px solid ${expanded ? color + '30' : 'var(--vx-edge)'}`,
        transition: 'border-color 250ms ease, box-shadow 250ms ease',
        boxShadow: expanded ? `0 0 20px ${color}08` : 'none',
        animation: `pp-fade-up 400ms cubic-bezier(0.22,1,0.36,1) ${index * 60}ms both`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{
          fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 14,
          color: color, opacity: 0.5, minWidth: 20,
          transition: 'opacity 200ms ease',
          ...(expanded ? { opacity: 0.9 } : {}),
        }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <span style={{
          fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15,
          color: 'var(--vx-text)', flex: 1,
        }}>
          {tip.title}
        </span>
        <span className="material-symbols-outlined" style={{
          fontSize: 18, color: expanded ? color : 'var(--vx-text-4)',
          transition: 'transform 300ms cubic-bezier(0.34,1.56,0.64,1), color 250ms ease',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          expand_more
        </span>
      </div>
      <div style={{
        overflow: 'hidden',
        maxHeight: expanded ? bodyH + 20 : 0,
        transition: 'max-height 350ms cubic-bezier(0.22,1,0.36,1)',
      }}>
        <div ref={bodyRef}>
          <div style={{
            maxHeight: 200,
            overflowY: 'auto',
            marginTop: 14,
            paddingLeft: 34,
            WebkitOverflowScrolling: 'touch',
          }}>
            <p style={{
              fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: 'var(--vx-text-2)',
              lineHeight: 1.7, margin: 0,
              animation: expanded ? 'pp-expand 300ms cubic-bezier(0.22,1,0.36,1) both' : 'none',
            }}>
              {tip.body}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionView({ section }: { section: Section }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {section.tips.map((tip, i) => (
        <TipCard key={i} tip={tip} color={section.color} index={i} />
      ))}
    </div>
  );
}

export default function PracticePanel() {
  useAnimStyle();
  const t = useT();
  const sections = useMemo(() => buildSections(t.vocalex as any), [t]);
  const [transitioning, setTransitioning] = useState(false);
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [displaySection, setDisplaySection] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const goToSection = useCallback((id: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDirection('in');
    setTransitioning(true);
    setDisplaySection(id);
    timerRef.current = setTimeout(() => {
      setTransitioning(false);
      timerRef.current = null;
    }, 400);
  }, []);

  const goBack = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDirection('out');
    setTransitioning(true);
    timerRef.current = setTimeout(() => {
      setDisplaySection(null);
      setTransitioning(false);
      timerRef.current = null;
    }, 250);
  }, []);

  useEffect(() => {
    if (!displaySection) {
      setVocalexBack(null);
      return;
    }
    setVocalexBack(() => goBack());
    return () => setVocalexBack(null);
  }, [displaySection, goBack]);

  if (displaySection) {
    const section = sections.find(s => s.id === displaySection)!;
    return (
      <div style={{
        padding: '16px 20px', minHeight: '100%',
        animation: direction === 'in'
          ? 'pp-slide-in 350ms cubic-bezier(0.22,1,0.36,1) both'
          : (transitioning ? 'pp-slide-out 250ms cubic-bezier(0.22,1,0.36,1) both' : 'none'),
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24,
          animation: 'pp-fade-up 400ms cubic-bezier(0.22,1,0.36,1) 50ms both',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `${section.color}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: section.color }}>
              {section.icon}
            </span>
          </div>
          <div>
            <h2 style={{
              fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 22,
              color: 'var(--vx-text)', margin: 0,
            }}>
              {section.name}
            </h2>
            <span style={{
              fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--vx-text-3)',
            }}>
              {t.vocalex.tipsCount(section.tips.length)}
            </span>
          </div>
        </div>

        <SectionView section={section} />
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 20px', minHeight: '100%' }}>
      <h2 style={{
        fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 24,
        color: 'var(--vx-text)', margin: '0 0 6px',
        animation: 'pp-fade-up 400ms cubic-bezier(0.22,1,0.36,1) both',
      }}>
        {t.vocalex.tipsTitle}
      </h2>
      <p style={{
        fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--vx-text-3)',
        margin: '0 0 28px', lineHeight: 1.5,
        animation: 'pp-fade-up 400ms cubic-bezier(0.22,1,0.36,1) 60ms both',
      }}>
        {t.vocalex.tipsSubtitle}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sections.map((section, i) => (
          <div
            key={section.id}
            onClick={() => goToSection(section.id)}
            style={{
              background: 'var(--vx-card)',
              borderRadius: 16,
              padding: '20px',
              cursor: 'pointer',
              border: '1px solid var(--vx-edge)',
              transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1), border-color 200ms ease, box-shadow 200ms ease',
              display: 'flex', alignItems: 'center', gap: 16,
              animation: `pp-fade-up 400ms cubic-bezier(0.22,1,0.36,1) ${100 + i * 50}ms both`,
            }}
            onPointerDown={e => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
            }}
            onPointerUp={e => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
            onPointerLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: `${section.color}12`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: section.color }}>
                {section.icon}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 16,
                color: 'var(--vx-text)', margin: 0,
              }}>
                {section.name}
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--vx-text-3)',
                margin: '3px 0 0',
              }}>
                {t.vocalex.tipsCount(section.tips.length)}
              </p>
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--vx-text-4)' }}>
              chevron_right
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
