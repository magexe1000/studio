interface IllustrationProps {
  progress: number;
  color: string;
}

export function BreathingBodyIllustration({ progress, color, phase }: IllustrationProps & { phase: string }) {
  const isIn = phase.toLowerCase().includes('breathe in') || phase.toLowerCase().includes('inhale') || phase.toLowerCase().includes('deep in');
  const isHold = phase.toLowerCase().includes('hold');
  const expansion = isIn ? progress : isHold ? 1 : (1 - progress);
  const ribExpand = expansion * 6;
  const bellyExpand = expansion * 8;

  return (
    <svg viewBox="0 0 120 140" width="120" height="140" style={{ overflow: 'visible' }}>
      <g fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
        <path d={`M 60 12 C 60 12 54 14 52 20`} />
        <ellipse cx="60" cy="8" rx="8" ry="9" />
        <path d={`M 52 20 L ${48 - ribExpand} 50 L ${44 - bellyExpand} 85 C ${44 - bellyExpand} 100 ${50 - bellyExpand} 110 55 120`} />
        <path d={`M 68 20 L ${72 + ribExpand} 50 L ${76 + bellyExpand} 85 C ${76 + bellyExpand} 100 ${70 + bellyExpand} 110 65 120`} />
        <path d={`M ${48 - ribExpand} 50 C ${52 - ribExpand * 0.5} ${54 + ribExpand} ${68 + ribExpand * 0.5} ${54 + ribExpand} ${72 + ribExpand} 50`} />
        <path d={`M ${44 - bellyExpand} 85 C ${50 - bellyExpand * 0.3} ${90 + bellyExpand} ${70 + bellyExpand * 0.3} ${90 + bellyExpand} ${76 + bellyExpand} 85`} strokeDasharray={isHold ? "3 3" : "none"} />
        <path d="M 52 20 L 32 55 L 35 60" />
        <path d="M 68 20 L 88 55 L 85 60" />
      </g>
      {isIn && (
        <g>
          <path d={`M ${36 - bellyExpand * 1.5} 72 L ${40 - bellyExpand} 72`} stroke={color} strokeWidth="1" opacity={0.3 + expansion * 0.5} strokeLinecap="round">
            <animate attributeName="opacity" values={`${0.3 + expansion * 0.3};${0.6 + expansion * 0.4};${0.3 + expansion * 0.3}`} dur="1.5s" repeatCount="indefinite" />
          </path>
          <path d={`M ${84 + bellyExpand} 72 L ${80 + bellyExpand * 1.5} 72`} stroke={color} strokeWidth="1" opacity={0.3 + expansion * 0.5} strokeLinecap="round">
            <animate attributeName="opacity" values={`${0.3 + expansion * 0.3};${0.6 + expansion * 0.4};${0.3 + expansion * 0.3}`} dur="1.5s" repeatCount="indefinite" />
          </path>
        </g>
      )}
      {!isIn && !isHold && (
        <g opacity={0.5}>
          <line x1="55" y1="4" x2="55" y2="-4" stroke={color} strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="-2;-8;-2" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
          </line>
          <line x1="60" y1="2" x2="60" y2="-6" stroke={color} strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="-4;-10;-4" dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0.7;0.4" dur="1.8s" repeatCount="indefinite" />
          </line>
          <line x1="65" y1="4" x2="65" y2="-4" stroke={color} strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="-2;-8;-2" dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2.2s" repeatCount="indefinite" />
          </line>
        </g>
      )}
    </svg>
  );
}

export function HummingFaceIllustration({ progress, color }: IllustrationProps) {
  const buzzOffset = Math.sin(progress * Math.PI * 20) * 0.5;
  return (
    <svg viewBox="0 0 100 110" width="100" height="110" style={{ overflow: 'visible' }}>
      <g fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
        <ellipse cx="50" cy="42" rx="26" ry="30" />
        <circle cx="40" cy="36" r="2" fill={color} opacity="0.5" />
        <circle cx="60" cy="36" r="2" fill={color} opacity="0.5" />
        <path d="M 43 55 Q 50 55 57 55" strokeWidth="2" />
        <path d="M 42 26 Q 38 22 35 25" />
        <path d="M 58 26 Q 62 22 65 25" />
        <path d={`M 50 72 L 50 82 L 48 88`} />
        <path d={`M 50 82 L 52 88`} />
      </g>
      <g opacity="0.5">
        <circle cx={30 + buzzOffset} cy="50" r="2" fill="none" stroke={color} strokeWidth="0.8">
          <animate attributeName="r" values="1;4;1" dur="0.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0.1;0.6" dur="0.6s" repeatCount="indefinite" />
        </circle>
        <circle cx={70 - buzzOffset} cy="50" r="2" fill="none" stroke={color} strokeWidth="0.8">
          <animate attributeName="r" values="1;4;1" dur="0.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0.1;0.6" dur="0.6s" repeatCount="indefinite" />
        </circle>
        <circle cx={25 + buzzOffset * 0.5} cy="45" r="1.5" fill="none" stroke={color} strokeWidth="0.6">
          <animate attributeName="r" values="1;5;1" dur="0.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0.05;0.4" dur="0.8s" repeatCount="indefinite" />
        </circle>
        <circle cx={75 - buzzOffset * 0.5} cy="45" r="1.5" fill="none" stroke={color} strokeWidth="0.6">
          <animate attributeName="r" values="1;5;1" dur="0.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0.05;0.4" dur="0.8s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}

export function MouthShapeIllustration({ color, vowel, progress }: IllustrationProps & { vowel: string }) {
  const shapes: Record<string, { w: number; h: number; lipY: number; jawDrop: number; tongueY: number }> = {
    'EE': { w: 22, h: 6, lipY: 56, jawDrop: 0, tongueY: 52 },
    'EH': { w: 18, h: 10, lipY: 56, jawDrop: 3, tongueY: 54 },
    'AH': { w: 16, h: 18, lipY: 56, jawDrop: 8, tongueY: 60 },
    'OH': { w: 12, h: 14, lipY: 56, jawDrop: 5, tongueY: 58 },
    'OO': { w: 8, h: 10, lipY: 56, jawDrop: 2, tongueY: 56 },
    'UH': { w: 14, h: 12, lipY: 56, jawDrop: 4, tongueY: 57 },
    'NG': { w: 18, h: 3, lipY: 56, jawDrop: 0, tongueY: 50 },
  };
  const key = vowel.toUpperCase().split('→')[0];
  const s = shapes[key] ?? { w: 16, h: 14, lipY: 56, jawDrop: 5, tongueY: 58 };
  const pulse = 1 + Math.sin(progress * Math.PI * 4) * 0.02;

  return (
    <svg viewBox="0 0 100 100" width="100" height="100" style={{ overflow: 'visible' }}>
      <g fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
        <ellipse cx="50" cy="42" rx="26" ry="30" />
        <circle cx="40" cy="36" r="2" fill={color} opacity="0.5" />
        <circle cx="60" cy="36" r="2" fill={color} opacity="0.5" />
        <path d="M 42 26 Q 38 22 35 25" />
        <path d="M 58 26 Q 62 22 65 25" />
        <ellipse
          cx="50"
          cy={s.lipY + s.jawDrop * 0.5}
          rx={s.w * 0.5 * pulse}
          ry={s.h * 0.5 * pulse}
          fill={`${color}15`}
          stroke={color}
          strokeWidth="2"
          style={{ transition: 'all 300ms ease' }}
        />
        {s.h > 8 && (
          <path
            d={`M ${50 - s.w * 0.3} ${s.tongueY + s.jawDrop} Q 50 ${s.tongueY + s.jawDrop + 3} ${50 + s.w * 0.3} ${s.tongueY + s.jawDrop}`}
            stroke={color}
            strokeWidth="1"
            opacity="0.4"
          />
        )}
        <path d={`M 26 ${48 + s.jawDrop * 0.3} Q 24 ${56 + s.jawDrop} 28 ${64 + s.jawDrop}`} />
        <path d={`M 74 ${48 + s.jawDrop * 0.3} Q 76 ${56 + s.jawDrop} 72 ${64 + s.jawDrop}`} />
      </g>
    </svg>
  );
}

export function SingingFaceIllustration({ progress, color, note }: IllustrationProps & { note?: string }) {
  const mouthOpen = 8 + Math.sin(progress * Math.PI * 2) * 2;
  return (
    <svg viewBox="0 0 100 110" width="100" height="110" style={{ overflow: 'visible' }}>
      <g fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
        <ellipse cx="50" cy="42" rx="26" ry="30" />
        <circle cx="40" cy="36" r="2" fill={color} opacity="0.5" />
        <circle cx="60" cy="36" r="2" fill={color} opacity="0.5" />
        <path d="M 42 26 Q 38 22 35 25" />
        <path d="M 58 26 Q 62 22 65 25" />
        <ellipse cx="50" cy="56" rx="8" ry={mouthOpen} fill={`${color}10`} stroke={color} strokeWidth="2" />
      </g>
      <g opacity="0.4">
        <path d={`M 78 42 Q 86 ${36 - progress * 4} 90 ${38 - progress * 6}`} fill="none" stroke={color} strokeWidth="1">
          <animate attributeName="opacity" values="0.2;0.5;0.2" dur="1.2s" repeatCount="indefinite" />
        </path>
        <path d={`M 80 48 Q 88 ${44 - progress * 3} 94 ${46 - progress * 5}`} fill="none" stroke={color} strokeWidth="1">
          <animate attributeName="opacity" values="0.3;0.5;0.3" dur="1.5s" repeatCount="indefinite" />
        </path>
      </g>
      {note && (
        <g>
          <text x="88" y="34" fill={color} fontSize="10" fontWeight="700" fontFamily="Manrope, sans-serif" opacity="0.6">
            {note}
          </text>
        </g>
      )}
    </svg>
  );
}

export function LipTrillIllustration({ progress, color }: IllustrationProps) {
  const trillPhase = progress * Math.PI * 30;
  const lipFlutter = Math.sin(trillPhase) * 2;
  return (
    <svg viewBox="0 0 100 100" width="100" height="100" style={{ overflow: 'visible' }}>
      <g fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
        <ellipse cx="50" cy="42" rx="26" ry="30" />
        <circle cx="40" cy="36" r="2" fill={color} opacity="0.5" />
        <circle cx="60" cy="36" r="2" fill={color} opacity="0.5" />
        <path d="M 42 26 Q 38 22 35 25" />
        <path d="M 58 26 Q 62 22 65 25" />
        <path d={`M 40 ${54 + lipFlutter * 0.5} Q 45 ${52 + lipFlutter} 50 ${53 + lipFlutter * 0.8} Q 55 ${52 + lipFlutter} 60 ${54 + lipFlutter * 0.5}`} strokeWidth="2" />
        <path d={`M 40 ${56 - lipFlutter * 0.5} Q 45 ${58 - lipFlutter} 50 ${57 - lipFlutter * 0.8} Q 55 ${58 - lipFlutter} 60 ${56 - lipFlutter * 0.5}`} strokeWidth="2" />
      </g>
      <g opacity="0.35">
        <line x1="62" y1={55 + lipFlutter * 0.3} x2="72" y2={52 + lipFlutter * 0.5} stroke={color} strokeWidth="0.8">
          <animate attributeName="x2" values="70;76;70" dur="0.3s" repeatCount="indefinite" />
        </line>
        <line x1="63" y1={57 + lipFlutter * 0.3} x2="74" y2={56 + lipFlutter * 0.5} stroke={color} strokeWidth="0.8">
          <animate attributeName="x2" values="72;78;72" dur="0.35s" repeatCount="indefinite" />
        </line>
        <line x1="62" y1={59 - lipFlutter * 0.3} x2="70" y2={60 - lipFlutter * 0.5} stroke={color} strokeWidth="0.8">
          <animate attributeName="x2" values="68;74;68" dur="0.32s" repeatCount="indefinite" />
        </line>
      </g>
    </svg>
  );
}

export function SireneSlideIllustration({ progress, color }: IllustrationProps) {
  const pitch = Math.sin(progress * Math.PI);
  const headY = 30 - pitch * 10;
  const mouthH = 6 + pitch * 8;
  return (
    <svg viewBox="0 0 100 120" width="100" height="120" style={{ overflow: 'visible' }}>
      <g fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
        <ellipse cx="50" cy={headY + 12} rx="22" ry="26" />
        <circle cx="42" cy={headY + 8} r="1.5" fill={color} opacity="0.5" />
        <circle cx="58" cy={headY + 8} r="1.5" fill={color} opacity="0.5" />
        <ellipse cx="50" cy={headY + 26} rx="6" ry={mouthH} fill={`${color}10`} stroke={color} strokeWidth="2" />
        <path d={`M 50 ${headY + 38} L 50 ${headY + 55}`} />
        <path d={`M 50 ${headY + 55} L 44 ${headY + 72}`} />
        <path d={`M 50 ${headY + 55} L 56 ${headY + 72}`} />
      </g>
      <g opacity="0.3">
        <path d={`M 10 ${90 - pitch * 60} L 30 ${80 - pitch * 40} L 50 ${90 - pitch * 60} L 70 ${80 - pitch * 40} L 90 ${90 - pitch * 60}`}
          fill="none" stroke={color} strokeWidth="1" />
        <circle cx={progress * 80 + 10} cy={90 - pitch * 60} r="3" fill={color} opacity="0.6" />
      </g>
    </svg>
  );
}

export function StaccatoIllustration({ progress, color }: IllustrationProps) {
  const burstPhase = (progress * 8) % 1;
  const isBurst = burstPhase < 0.3;
  const mouthR = isBurst ? 8 : 4;
  return (
    <svg viewBox="0 0 100 100" width="100" height="100" style={{ overflow: 'visible' }}>
      <g fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
        <ellipse cx="50" cy="42" rx="26" ry="30" />
        <circle cx="40" cy="36" r="2" fill={color} opacity="0.5" />
        <circle cx="60" cy="36" r="2" fill={color} opacity="0.5" />
        <path d="M 42 26 Q 38 22 35 25" />
        <path d="M 58 26 Q 62 22 65 25" />
        <ellipse cx="50" cy="56" rx={mouthR * 0.8} ry={mouthR} fill={isBurst ? `${color}20` : 'none'} stroke={color} strokeWidth="2"
          style={{ transition: 'all 80ms ease' }} />
      </g>
      {isBurst && (
        <g opacity="0.5">
          <line x1="64" y1="50" x2="74" y2="46" stroke={color} strokeWidth="1" />
          <line x1="66" y1="56" x2="76" y2="56" stroke={color} strokeWidth="1" />
          <line x1="64" y1="62" x2="74" y2="66" stroke={color} strokeWidth="1" />
        </g>
      )}
    </svg>
  );
}

export function SustainBodyIllustration({ progress, color }: IllustrationProps) {
  const pct = Math.round(progress * 100);
  return (
    <svg viewBox="0 0 120 130" width="120" height="130" style={{ overflow: 'visible' }}>
      <g fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
        <ellipse cx="60" cy="20" rx="14" ry="16" />
        <path d="M 46 36 L 40 60 L 38 80 C 38 92 48 98 55 105" />
        <path d="M 74 36 L 80 60 L 82 80 C 82 92 72 98 65 105" />
        <path d="M 46 36 L 30 52 L 32 56" />
        <path d="M 74 36 L 90 52 L 88 56" />
        <ellipse cx="60" cy="65" rx={14 + progress * 3} ry={12 + progress * 2} strokeDasharray="3 3" opacity="0.5" />
      </g>
      <g>
        <circle cx="60" cy="65" r="22" fill="none" stroke={`${color}40`} strokeWidth="2" />
        <circle cx="60" cy="65" r="22" fill="none" stroke={color} strokeWidth="2"
          strokeDasharray={`${progress * 138} ${138 - progress * 138}`}
          strokeLinecap="round"
          transform="rotate(-90 60 65)"
          opacity="0.7"
        />
        <text x="60" y="69" textAnchor="middle" fill={color} fontSize="10" fontWeight="700" fontFamily="Manrope, sans-serif" opacity="0.7">
          {pct}%
        </text>
      </g>
    </svg>
  );
}
