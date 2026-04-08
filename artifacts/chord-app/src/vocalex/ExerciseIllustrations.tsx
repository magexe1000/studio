interface IllustrationProps {
  progress: number;
  color: string;
}

export function BreathingBodyIllustration({ progress, color, phase }: IllustrationProps & { phase: string }) {
  const isIn = /breathe in|inhale|deep in|sniff/i.test(phase);
  const isHold = /hold/i.test(phase);
  const t = isIn ? progress : isHold ? 1 : 1 - progress;
  const e = t * 1;

  return (
    <svg viewBox="0 0 140 160" width="120" height="138" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="breathGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
        <path d={`
          M 70 8
          C 58 8, 52 16, 52 26
          C 52 32, 55 38, 60 40
          L 60 42
        `} />
        <path d={`
          M 70 8
          C 82 8, 88 16, 88 26
          C 88 32, 85 38, 80 40
          L 80 42
        `} />
        <ellipse cx="63" cy="24" rx="1.5" ry="1" fill={color} opacity="0.4" />
        <ellipse cx="77" cy="24" rx="1.5" ry="1" fill={color} opacity="0.4" />
        <path d="M 66 33 Q 70 35 74 33" strokeWidth="1" opacity="0.5" />
        <path d={`
          M 60 42
          C 56 44, ${48 - e * 5} 50, ${44 - e * 6} 60
          C ${40 - e * 7} 72, ${38 - e * 8} 86, ${40 - e * 7} 100
          C ${42 - e * 6} 112, 50 122, 58 135
        `} />
        <path d={`
          M 80 42
          C 84 44, ${92 + e * 5} 50, ${96 + e * 6} 60
          C ${100 + e * 7} 72, ${102 + e * 8} 86, ${100 + e * 7} 100
          C ${98 + e * 6} 112, 90 122, 82 135
        `} />
        <path d={`
          M 60 42 C 54 44, 38 50, 28 58 C 22 63, 20 68, 22 72
        `} strokeWidth="1.2" />
        <path d={`
          M 80 42 C 86 44, 102 50, 112 58 C 118 63, 120 68, 118 72
        `} strokeWidth="1.2" />
        <path d={`
          M ${48 - e * 5} ${62 + e * 2}
          Q 70 ${58 + e * 6} ${92 + e * 5} ${62 + e * 2}
        `} strokeDasharray={isHold ? "3 3" : "none"} strokeWidth="1" opacity="0.4" />
        <path d={`
          M ${42 - e * 7} ${84 + e * 2}
          Q 70 ${80 + e * 8} ${98 + e * 7} ${84 + e * 2}
        `} strokeDasharray={isHold ? "3 3" : "none"} strokeWidth="1" opacity="0.3" />
      </g>
      {isIn && (
        <g opacity={0.3 + t * 0.4}>
          <path d={`M ${32 - e * 10} 70 L ${38 - e * 6} 68`} stroke={color} strokeWidth="1" strokeLinecap="round">
            <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1.8s" repeatCount="indefinite" />
          </path>
          <path d={`M ${30 - e * 10} 80 L ${36 - e * 6} 80`} stroke={color} strokeWidth="1" strokeLinecap="round">
            <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.5s" repeatCount="indefinite" />
          </path>
          <path d={`M ${108 + e * 10} 70 L ${102 + e * 6} 68`} stroke={color} strokeWidth="1" strokeLinecap="round">
            <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1.8s" repeatCount="indefinite" />
          </path>
          <path d={`M ${110 + e * 10} 80 L ${104 + e * 6} 80`} stroke={color} strokeWidth="1" strokeLinecap="round">
            <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.5s" repeatCount="indefinite" />
          </path>
        </g>
      )}
      {!isIn && !isHold && (
        <g opacity="0.4">
          <path d="M 67 6 L 66 -2" stroke={color} strokeWidth="0.8" strokeLinecap="round">
            <animate attributeName="d" values="M 67 6 L 66 -2;M 67 6 L 66 -8;M 67 6 L 66 -2" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2s" repeatCount="indefinite" />
          </path>
          <path d="M 70 4 L 70 -4" stroke={color} strokeWidth="0.8" strokeLinecap="round">
            <animate attributeName="d" values="M 70 4 L 70 -4;M 70 4 L 70 -10;M 70 4 L 70 -4" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0.6;0.3" dur="1.6s" repeatCount="indefinite" />
          </path>
          <path d="M 73 6 L 74 -2" stroke={color} strokeWidth="0.8" strokeLinecap="round">
            <animate attributeName="d" values="M 73 6 L 74 -2;M 73 6 L 74 -8;M 73 6 L 74 -2" dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2.2s" repeatCount="indefinite" />
          </path>
        </g>
      )}
    </svg>
  );
}

export function HummingFaceIllustration({ progress, color }: IllustrationProps) {
  const _ = progress;
  return (
    <svg viewBox="0 0 120 120" width="110" height="110" style={{ overflow: 'visible' }}>
      <g fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
        <path d={`
          M 60 6
          C 40 6, 26 20, 26 42
          C 26 56, 32 66, 42 72
          L 42 78
          C 42 84, 48 88, 54 88
          L 66 88
          C 72 88, 78 84, 78 78
          L 78 72
          C 88 66, 94 56, 94 42
          C 94 20, 80 6, 60 6 Z
        `} />
        <path d="M 46 38 C 46 35, 48 33, 51 33 C 54 33, 56 35, 56 38" strokeWidth="1.2" />
        <path d="M 64 38 C 64 35, 66 33, 69 33 C 72 33, 74 35, 74 38" strokeWidth="1.2" />
        <circle cx="51" cy="40" r="1.2" fill={color} opacity="0.5" />
        <circle cx="69" cy="40" r="1.2" fill={color} opacity="0.5" />
        <path d="M 55 50 Q 60 52 65 50" strokeWidth="1" opacity="0.6" />
        <path d="M 51 58 L 69 58" strokeWidth="1.8" />
        <path d="M 42 88 L 48 100" strokeWidth="1.2" />
        <path d="M 78 88 L 72 100" strokeWidth="1.2" />
      </g>
      <g opacity="0.5">
        <circle cx="22" cy="56" r="3" fill="none" stroke={color} strokeWidth="0.8">
          <animate attributeName="r" values="2;6;2" dur="0.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0.08;0.5" dur="0.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="98" cy="56" r="3" fill="none" stroke={color} strokeWidth="0.8">
          <animate attributeName="r" values="2;6;2" dur="0.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0.08;0.5" dur="0.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="18" cy="48" r="2" fill="none" stroke={color} strokeWidth="0.6">
          <animate attributeName="r" values="1;5;1" dur="0.7s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.04;0.3" dur="0.7s" repeatCount="indefinite" />
        </circle>
        <circle cx="102" cy="48" r="2" fill="none" stroke={color} strokeWidth="0.6">
          <animate attributeName="r" values="1;5;1" dur="0.7s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.04;0.3" dur="0.7s" repeatCount="indefinite" />
        </circle>
        <circle cx="16" cy="62" r="1.5" fill="none" stroke={color} strokeWidth="0.5">
          <animate attributeName="r" values="1;4;1" dur="0.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.25;0.04;0.25" dur="0.6s" repeatCount="indefinite" />
        </circle>
        <circle cx="104" cy="62" r="1.5" fill="none" stroke={color} strokeWidth="0.5">
          <animate attributeName="r" values="1;4;1" dur="0.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.25;0.04;0.25" dur="0.6s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}

const VOWEL_MOUTHS: Record<string, { upperLip: string; lowerLip: string; tongue?: string; jawShift: number; fill: boolean }> = {
  'EE': {
    upperLip: 'M 38 60 C 42 57, 50 56, 60 56 C 70 56, 78 57, 82 60',
    lowerLip: 'M 38 60 C 42 63, 50 64, 60 64 C 70 64, 78 63, 82 60',
    tongue: 'M 44 62 C 50 59, 58 59, 64 60 C 70 61, 76 62, 76 62',
    jawShift: 0,
    fill: false,
  },
  'EH': {
    upperLip: 'M 40 58 C 44 55, 52 54, 60 54 C 68 54, 76 55, 80 58',
    lowerLip: 'M 40 58 C 44 66, 52 68, 60 68 C 68 68, 76 66, 80 58',
    jawShift: 2,
    fill: true,
  },
  'AH': {
    upperLip: 'M 42 56 C 46 53, 54 52, 60 52 C 66 52, 74 53, 78 56',
    lowerLip: 'M 42 56 C 46 72, 54 76, 60 76 C 66 76, 74 72, 78 56',
    tongue: 'M 48 70 C 54 72, 60 72, 66 72 C 72 72, 72 70, 72 68',
    jawShift: 6,
    fill: true,
  },
  'OH': {
    upperLip: 'M 48 56 C 50 52, 56 50, 60 50 C 64 50, 70 52, 72 56',
    lowerLip: 'M 48 56 C 50 68, 56 72, 60 72 C 64 72, 70 68, 72 56',
    jawShift: 4,
    fill: true,
  },
  'OO': {
    upperLip: 'M 52 56 C 54 52, 58 50, 60 50 C 62 50, 66 52, 68 56',
    lowerLip: 'M 52 56 C 54 66, 58 68, 60 68 C 62 68, 66 66, 68 56',
    jawShift: 2,
    fill: true,
  },
};

export function MouthShapeIllustration({ color, vowel, progress }: IllustrationProps & { vowel: string }) {
  const key = vowel.replace(/[→↑↓.…\s]/g, '').toUpperCase().slice(0, 2);
  const mouth = VOWEL_MOUTHS[key] || VOWEL_MOUTHS['AH'];
  const jy = mouth.jawShift;
  const pulse = Math.sin(progress * Math.PI * 3) * 0.3;

  return (
    <svg viewBox="0 0 120 110" width="110" height="100" style={{ overflow: 'visible' }}>
      <g fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
        <path d={`
          M 60 4
          C 40 4, 28 18, 28 38
          C 28 50, 32 58, 38 64
          L 36 ${70 + jy}
          C 34 ${78 + jy}, 42 ${84 + jy}, 50 ${84 + jy}
          L 70 ${84 + jy}
          C 78 ${84 + jy}, 86 ${78 + jy}, 84 ${70 + jy}
          L 82 64
          C 88 58, 92 50, 92 38
          C 92 18, 80 4, 60 4 Z
        `} />
        <path d="M 46 34 C 46 31, 48 29, 51 29 C 54 29, 56 31, 56 34" strokeWidth="1.2" />
        <path d="M 64 34 C 64 31, 66 29, 69 29 C 72 29, 74 31, 74 34" strokeWidth="1.2" />
        <circle cx="51" cy="36" r="1.2" fill={color} opacity="0.5" />
        <circle cx="69" cy="36" r="1.2" fill={color} opacity="0.5" />
        <path d="M 55 46 Q 60 48 65 46" strokeWidth="1" opacity="0.5" />
      </g>
      <g transform={`translate(0, ${jy * 0.5})`} opacity={0.85 + pulse * 0.15}>
        {mouth.fill && (
          <path d={`${mouth.upperLip} ${mouth.lowerLip.replace('M', 'L').split('C').reverse().join('C')}`}
            fill={`${color}12`} stroke="none" />
        )}
        <path d={mouth.upperLip} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d={mouth.lowerLip} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        {mouth.tongue && (
          <path d={mouth.tongue} fill="none" stroke={color} strokeWidth="0.8" opacity="0.35" strokeLinecap="round" />
        )}
      </g>
    </svg>
  );
}

export function SingingFaceIllustration({ progress, color, note }: IllustrationProps & { note?: string }) {
  const breathe = Math.sin(progress * Math.PI * 2) * 1.5;

  return (
    <svg viewBox="0 0 120 115" width="110" height="105" style={{ overflow: 'visible' }}>
      <g fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
        <path d={`
          M 60 4
          C 40 4, 28 18, 28 38
          C 28 50, 32 58, 38 64
          L 36 72
          C 34 80, 42 86, 50 86
          L 70 86
          C 78 86, 86 80, 84 72
          L 82 64
          C 88 58, 92 50, 92 38
          C 92 18, 80 4, 60 4 Z
        `} />
        <path d="M 46 34 C 46 31, 48 29, 51 29 C 54 29, 56 31, 56 34" strokeWidth="1.2" />
        <path d="M 64 34 C 64 31, 66 29, 69 29 C 72 29, 74 31, 74 34" strokeWidth="1.2" />
        <circle cx="51" cy="36" r="1.2" fill={color} opacity="0.5" />
        <circle cx="69" cy="36" r="1.2" fill={color} opacity="0.5" />
        <path d="M 55 46 Q 60 48 65 46" strokeWidth="1" opacity="0.5" />
        <ellipse cx="60" cy={62 + breathe * 0.5} rx="8" ry={10 + breathe} fill={`${color}10`} stroke={color} strokeWidth="1.8" />
        <path d="M 50 86 L 46 100" strokeWidth="1.2" />
        <path d="M 70 86 L 74 100" strokeWidth="1.2" />
      </g>
      <g opacity="0.35">
        <path d="M 96 36 C 100 32, 104 34, 106 38" stroke={color} strokeWidth="1" strokeLinecap="round">
          <animate attributeName="opacity" values="0.15;0.4;0.15" dur="1.4s" repeatCount="indefinite" />
        </path>
        <path d="M 100 44 C 104 40, 108 42, 110 46" stroke={color} strokeWidth="0.8" strokeLinecap="round">
          <animate attributeName="opacity" values="0.1;0.35;0.1" dur="1.8s" repeatCount="indefinite" />
        </path>
        <path d="M 98 52 C 102 48, 106 50, 108 54" stroke={color} strokeWidth="0.6" strokeLinecap="round">
          <animate attributeName="opacity" values="0.1;0.3;0.1" dur="2s" repeatCount="indefinite" />
        </path>
      </g>
      {note && (
        <text x="104" y="30" fill={color} fontSize="9" fontWeight="600" fontFamily="Manrope, sans-serif" opacity="0.55" textAnchor="middle">
          {note}
        </text>
      )}
    </svg>
  );
}

export function LipTrillIllustration({ progress, color }: IllustrationProps) {
  const phase = progress * Math.PI * 40;
  const flutter = Math.sin(phase) * 1.8;
  const flutter2 = Math.sin(phase + 1) * 1.2;

  return (
    <svg viewBox="0 0 120 110" width="110" height="100" style={{ overflow: 'visible' }}>
      <g fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
        <path d={`
          M 60 4
          C 40 4, 28 18, 28 38
          C 28 50, 32 58, 38 64
          L 36 72
          C 34 80, 42 86, 50 86
          L 70 86
          C 78 86, 86 80, 84 72
          L 82 64
          C 88 58, 92 50, 92 38
          C 92 18, 80 4, 60 4 Z
        `} />
        <path d="M 46 34 C 46 31, 48 29, 51 29 C 54 29, 56 31, 56 34" strokeWidth="1.2" />
        <path d="M 64 34 C 64 31, 66 29, 69 29 C 72 29, 74 31, 74 34" strokeWidth="1.2" />
        <circle cx="51" cy="36" r="1.2" fill={color} opacity="0.5" />
        <circle cx="69" cy="36" r="1.2" fill={color} opacity="0.5" />
        <path d="M 55 46 Q 60 48 65 46" strokeWidth="1" opacity="0.5" />
        <path d={`
          M 48 ${56 + flutter}
          C 52 ${53 + flutter2}, 56 ${52 + flutter}, 60 ${53 + flutter2}
          C 64 ${52 + flutter}, 68 ${53 + flutter2}, 72 ${56 + flutter}
        `} strokeWidth="2" />
        <path d={`
          M 48 ${60 - flutter}
          C 52 ${63 - flutter2}, 56 ${64 - flutter}, 60 ${63 - flutter2}
          C 64 ${64 - flutter}, 68 ${63 - flutter2}, 72 ${60 - flutter}
        `} strokeWidth="2" />
      </g>
      <g opacity="0.3">
        <line x1="74" y1={57 + flutter * 0.4} x2="82" y2={55 + flutter * 0.6} stroke={color} strokeWidth="0.8" strokeLinecap="round">
          <animate attributeName="x2" values="80;86;80" dur="0.15s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.15;0.4;0.15" dur="0.15s" repeatCount="indefinite" />
        </line>
        <line x1="75" y1={59 - flutter * 0.3} x2="84" y2={60 - flutter * 0.5} stroke={color} strokeWidth="0.8" strokeLinecap="round">
          <animate attributeName="x2" values="82;88;82" dur="0.18s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.1;0.35;0.1" dur="0.18s" repeatCount="indefinite" />
        </line>
        <line x1="74" y1={61 - flutter * 0.4} x2="80" y2={63 - flutter * 0.6} stroke={color} strokeWidth="0.8" strokeLinecap="round">
          <animate attributeName="x2" values="78;84;78" dur="0.16s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.12;0.35;0.12" dur="0.16s" repeatCount="indefinite" />
        </line>
      </g>
    </svg>
  );
}

export function SireneSlideIllustration({ progress, color }: IllustrationProps) {
  const pitch = Math.sin(progress * Math.PI);
  const mouthH = 5 + pitch * 9;
  const headY = -pitch * 6;

  return (
    <svg viewBox="0 0 120 130" width="110" height="119" style={{ overflow: 'visible' }}>
      <g fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"
        transform={`translate(0, ${headY})`}>
        <path d={`
          M 60 4
          C 40 4, 28 18, 28 38
          C 28 50, 32 58, 38 64
          L 36 72
          C 34 80, 42 86, 50 86
          L 70 86
          C 78 86, 86 80, 84 72
          L 82 64
          C 88 58, 92 50, 92 38
          C 92 18, 80 4, 60 4 Z
        `} />
        <path d="M 46 34 C 46 31, 48 29, 51 29 C 54 29, 56 31, 56 34" strokeWidth="1.2" />
        <path d="M 64 34 C 64 31, 66 29, 69 29 C 72 29, 74 31, 74 34" strokeWidth="1.2" />
        <circle cx="51" cy="36" r="1.2" fill={color} opacity="0.5" />
        <circle cx="69" cy="36" r="1.2" fill={color} opacity="0.5" />
        <path d="M 55 46 Q 60 48 65 46" strokeWidth="1" opacity="0.5" />
        <ellipse cx="60" cy="60" rx={5 + pitch * 2} ry={mouthH} fill={`${color}10`} stroke={color} strokeWidth="1.8" />
      </g>
      <g opacity="0.4">
        <path d={`
          M 10 120
          C 30 ${120 - pitch * 50}, 50 ${100 + pitch * 10}, 70 ${120 - pitch * 60}
          C 90 ${100 + pitch * 10}, 110 ${120 - pitch * 50}
        `} fill="none" stroke={color} strokeWidth="1" opacity="0.3" />
        <circle cx={10 + progress * 100} cy={120 - pitch * 55} r="3.5" fill={color} opacity="0.5">
          <animate attributeName="r" values="3;4.5;3" dur="0.8s" repeatCount="indefinite" />
        </circle>
        <line x1="10" y1="122" x2="110" y2="122" stroke={color} strokeWidth="0.5" opacity="0.15" />
      </g>
    </svg>
  );
}

export function StaccatoIllustration({ progress, color }: IllustrationProps) {
  const burstPhase = (progress * 8) % 1;
  const isBurst = burstPhase < 0.25;
  const burstScale = isBurst ? 1 - burstPhase * 4 : 0;

  return (
    <svg viewBox="0 0 120 110" width="110" height="100" style={{ overflow: 'visible' }}>
      <g fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
        <path d={`
          M 60 4
          C 40 4, 28 18, 28 38
          C 28 50, 32 58, 38 64
          L 36 72
          C 34 80, 42 86, 50 86
          L 70 86
          C 78 86, 86 80, 84 72
          L 82 64
          C 88 58, 92 50, 92 38
          C 92 18, 80 4, 60 4 Z
        `} />
        <path d="M 46 34 C 46 31, 48 29, 51 29 C 54 29, 56 31, 56 34" strokeWidth="1.2" />
        <path d="M 64 34 C 64 31, 66 29, 69 29 C 72 29, 74 31, 74 34" strokeWidth="1.2" />
        <circle cx="51" cy="36" r="1.2" fill={color} opacity="0.5" />
        <circle cx="69" cy="36" r="1.2" fill={color} opacity="0.5" />
        <path d="M 55 46 Q 60 48 65 46" strokeWidth="1" opacity="0.5" />
        <ellipse cx="60" cy="60" rx={isBurst ? 7 : 4} ry={isBurst ? 9 : 5}
          fill={isBurst ? `${color}18` : 'none'} stroke={color} strokeWidth="1.8"
          style={{ transition: 'all 60ms ease-out' }} />
      </g>
      {isBurst && (
        <g opacity={burstScale * 0.6}>
          <line x1="72" y1="54" x2={72 + burstScale * 14} y2={50 - burstScale * 4} stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <line x1="74" y1="60" x2={74 + burstScale * 16} y2="60" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <line x1="72" y1="66" x2={72 + burstScale * 14} y2={70 + burstScale * 4} stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <circle cx={74 + burstScale * 18} cy={48 - burstScale * 6} r="1.2" fill={color} opacity={burstScale * 0.5} />
          <circle cx={76 + burstScale * 20} cy={60} r="1" fill={color} opacity={burstScale * 0.4} />
          <circle cx={74 + burstScale * 18} cy={72 + burstScale * 6} r="1.2" fill={color} opacity={burstScale * 0.5} />
        </g>
      )}
    </svg>
  );
}

export function SustainBodyIllustration({ progress, color }: IllustrationProps) {
  const breathe = Math.sin(progress * Math.PI * 4) * 0.8;

  return (
    <svg viewBox="0 0 140 155" width="120" height="133" style={{ overflow: 'visible' }}>
      <g fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
        <path d={`
          M 70 8
          C 58 8, 52 16, 52 26
          C 52 32, 55 38, 60 40
          L 60 42
        `} />
        <path d={`
          M 70 8
          C 82 8, 88 16, 88 26
          C 88 32, 85 38, 80 40
          L 80 42
        `} />
        <ellipse cx="63" cy="24" rx="1.5" ry="1" fill={color} opacity="0.4" />
        <ellipse cx="77" cy="24" rx="1.5" ry="1" fill={color} opacity="0.4" />
        <ellipse cx="70" cy="34" rx="3" ry="4" fill={`${color}10`} stroke={color} strokeWidth="1" />
        <path d={`
          M 60 42
          C 56 44, 48 50, 44 60
          C 40 72, 38 86, 40 100
          C 42 112, 50 122, 58 135
        `} />
        <path d={`
          M 80 42
          C 84 44, 92 50, 96 60
          C 100 72, 102 86, 100 100
          C 98 112, 90 122, 82 135
        `} />
        <path d="M 60 42 C 54 44, 38 50, 28 58 C 22 63, 20 68, 22 72" strokeWidth="1.2" />
        <path d="M 80 42 C 86 44, 102 50, 112 58 C 118 63, 120 68, 118 72" strokeWidth="1.2" />
        <ellipse cx="70" cy={78 + breathe} rx={16 + breathe * 2} ry={14 + breathe} strokeDasharray="3 3" opacity="0.3" />
      </g>
      <g>
        <circle cx="70" cy="78" r="24" fill="none" stroke={`${color}30`} strokeWidth="2" />
        <circle cx="70" cy="78" r="24" fill="none" stroke={color} strokeWidth="2.5"
          strokeDasharray={`${progress * 150.8} ${150.8 - progress * 150.8}`}
          strokeLinecap="round"
          transform="rotate(-90 70 78)"
          opacity="0.65"
        />
        <text x="70" y="82" textAnchor="middle" fill={color} fontSize="11" fontWeight="700" fontFamily="Manrope, sans-serif" opacity="0.65">
          {Math.round(progress * 100)}%
        </text>
      </g>
    </svg>
  );
}
