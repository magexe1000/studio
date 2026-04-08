interface IllustrationProps {
  progress: number;
  color: string;
}

const S: React.CSSProperties = { overflow: 'visible', display: 'block' };

export function BreathingBodyIllustration({ progress, color, phase }: IllustrationProps & { phase: string }) {
  const isIn = /breathe in|inhale|deep in|sniff/i.test(phase);
  const isHold = /hold/i.test(phase);
  const t = isIn ? progress : isHold ? 1 : 1 - progress;
  const e = t * 5;

  return (
    <svg viewBox="0 0 100 100" width="96" height="96" style={S}>
      <g fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
        <path d={`M 50 22 C 50 22 44 24 43 30`} />
        <circle cx="46" cy="18" r="2" fill={color} />
        <circle cx="55" cy="17" r="2" fill={color} />
        <path d="M 48 25 Q 51 27 54 25" />

        <path d={`M 43 30 C 40 34 ${36 - e} 42 ${34 - e} 54`} />
        <path d={`M 57 30 C 60 34 ${64 + e} 42 ${66 + e} 54`} />
        <path d={`M 50 22 C 50 22 56 24 57 30`} />

        <path d={`M ${34 - e} 54 C ${36 - e * 0.8} 64 42 74 46 82`} />
        <path d={`M ${66 + e} 54 C ${64 + e * 0.8} 64 58 74 54 82`} />

        <path d="M 43 30 L 30 42" strokeWidth="1.2" />
        <path d="M 57 30 L 70 42" strokeWidth="1.2" />
      </g>

      {isIn && (
        <g stroke={color} strokeWidth="1" strokeLinecap="round" opacity={0.25 + t * 0.3}>
          <path d={`M ${26 - e * 2} 48 L ${30 - e} 48`}>
            <animate attributeName="opacity" values="0.15;0.5;0.15" dur="1.6s" repeatCount="indefinite" />
          </path>
          <path d={`M ${74 + e} 48 L ${70 + e * 2} 48`}>
            <animate attributeName="opacity" values="0.15;0.5;0.15" dur="1.6s" repeatCount="indefinite" />
          </path>
        </g>
      )}
      {!isIn && !isHold && (
        <g stroke={color} strokeWidth="1" strokeLinecap="round">
          <line x1="49" y1="13" x2="48" y2="6" opacity="0.3">
            <animate attributeName="y2" values="8;2;8" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.15;0.4;0.15" dur="2s" repeatCount="indefinite" />
          </line>
          <line x1="53" y1="13" x2="54" y2="6" opacity="0.3">
            <animate attributeName="y2" values="8;2;8" dur="2.3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.15;0.4;0.15" dur="2.3s" repeatCount="indefinite" />
          </line>
        </g>
      )}
    </svg>
  );
}

export function HummingFaceIllustration({ progress, color }: IllustrationProps) {
  const _ = progress;
  return (
    <svg viewBox="0 0 100 100" width="96" height="96" style={S}>
      <g fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
        <path d="M 32 50 C 30 30 42 16 54 16 C 66 16 76 28 74 50" />
        <path d="M 32 50 C 32 64 40 74 50 76" />
        <path d="M 74 50 C 74 64 66 74 56 76" />

        <circle cx="43" cy="38" r="2.5" fill={color} />
        <circle cx="61" cy="38" r="2.5" fill={color} />

        <line x1="44" y1="56" x2="60" y2="56" strokeWidth="2" />
      </g>

      <g opacity="0.4">
        <path d="M 28 52 Q 24 50 22 52" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none">
          <animate attributeName="opacity" values="0.2;0.5;0.2" dur="0.55s" repeatCount="indefinite" />
        </path>
        <path d="M 24 48 Q 20 46 18 48" stroke={color} strokeWidth="1" strokeLinecap="round" fill="none">
          <animate attributeName="opacity" values="0.1;0.4;0.1" dur="0.65s" repeatCount="indefinite" />
        </path>
        <path d="M 76 52 Q 80 50 82 52" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none">
          <animate attributeName="opacity" values="0.2;0.5;0.2" dur="0.55s" repeatCount="indefinite" />
        </path>
        <path d="M 80 48 Q 84 46 86 48" stroke={color} strokeWidth="1" strokeLinecap="round" fill="none">
          <animate attributeName="opacity" values="0.1;0.4;0.1" dur="0.65s" repeatCount="indefinite" />
        </path>
      </g>
    </svg>
  );
}

export function MouthShapeIllustration({ color, vowel, progress }: IllustrationProps & { vowel: string }) {
  const key = vowel.replace(/[→↑↓.…\s]/g, '').toUpperCase().slice(0, 2);
  const _ = progress;

  const mouths: Record<string, string> = {
    'EE': 'M 40 56 Q 50 52 60 56',
    'EH': 'M 42 54 Q 50 60 58 54',
    'AH': 'M 42 52 C 44 62 56 62 58 52',
    'OH': 'M 46 52 C 46 60 56 60 56 52',
    'OO': 'M 48 52 C 48 58 54 58 54 52',
    'UH': 'M 44 54 C 44 60 58 60 58 54',
    'NG': 'M 42 56 Q 50 54 58 56',
    'MM': 'M 42 56 Q 50 56 58 56',
  };

  const mouth = mouths[key] || mouths['AH'];

  return (
    <svg viewBox="0 0 100 100" width="96" height="96" style={S}>
      <g fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
        <path d="M 32 50 C 30 30 42 16 54 16 C 66 16 76 28 74 50" />
        <path d="M 32 50 C 32 64 40 74 50 76" />
        <path d="M 74 50 C 74 64 66 74 56 76" />

        <circle cx="43" cy="38" r="2.5" fill={color} />
        <circle cx="61" cy="38" r="2.5" fill={color} />

        <path d="M 52 46 L 52 50" strokeWidth="1" opacity="0.4" />
      </g>

      <path d={mouth} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export function SingingFaceIllustration({ progress, color, note }: IllustrationProps & { note?: string }) {
  const breathe = Math.sin(progress * Math.PI * 2) * 1;

  return (
    <svg viewBox="0 0 100 100" width="96" height="96" style={S}>
      <g fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
        <path d="M 32 50 C 30 30 42 16 54 16 C 66 16 76 28 74 50" />
        <path d="M 32 50 C 32 64 40 74 50 76" />
        <path d="M 74 50 C 74 64 66 74 56 76" />

        <circle cx="43" cy="38" r="2.5" fill={color} />
        <circle cx="61" cy="38" r="2.5" fill={color} />

        <ellipse cx="52" cy={57 + breathe * 0.3} rx="5" ry={5 + breathe} fill="none" stroke={color} strokeWidth="1.8" />
      </g>

      <g opacity="0.3">
        <path d="M 78 42 Q 82 39 85 42" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none">
          <animate attributeName="opacity" values="0.1;0.35;0.1" dur="1.4s" repeatCount="indefinite" />
        </path>
        <path d="M 80 48 Q 84 45 87 48" stroke={color} strokeWidth="1" strokeLinecap="round" fill="none">
          <animate attributeName="opacity" values="0.1;0.3;0.1" dur="1.8s" repeatCount="indefinite" />
        </path>
      </g>
      {note && (
        <text x="86" y="36" fill={color} fontSize="8" fontWeight="600" fontFamily="Manrope, sans-serif" opacity="0.45" textAnchor="middle">
          {note}
        </text>
      )}
    </svg>
  );
}

export function LipTrillIllustration({ progress, color }: IllustrationProps) {
  const phase = progress * Math.PI * 40;
  const f = Math.sin(phase) * 2;

  return (
    <svg viewBox="0 0 100 100" width="96" height="96" style={S}>
      <g fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
        <path d="M 32 50 C 30 30 42 16 54 16 C 66 16 76 28 74 50" />
        <path d="M 32 50 C 32 64 40 74 50 76" />
        <path d="M 74 50 C 74 64 66 74 56 76" />

        <circle cx="43" cy="38" r="2.5" fill={color} />
        <circle cx="61" cy="38" r="2.5" fill={color} />

        <path d={`M 42 ${55 + f * 0.5} Q 50 ${53 + f} 58 ${55 + f * 0.5}`} strokeWidth="2" />
        <path d={`M 42 ${57 - f * 0.5} Q 50 ${59 - f} 58 ${57 - f * 0.5}`} strokeWidth="2" />
      </g>

      <g opacity="0.28">
        <line x1="60" y1={56} x2="68" y2={54 + f * 0.3} stroke={color} strokeWidth="1" strokeLinecap="round">
          <animate attributeName="x2" values="66;72;66" dur="0.14s" repeatCount="indefinite" />
        </line>
        <line x1="60" y1={58} x2="70" y2={58 - f * 0.3} stroke={color} strokeWidth="1" strokeLinecap="round">
          <animate attributeName="x2" values="68;74;68" dur="0.16s" repeatCount="indefinite" />
        </line>
      </g>
    </svg>
  );
}

export function SireneSlideIllustration({ progress, color }: IllustrationProps) {
  const pitch = Math.sin(progress * Math.PI);
  const tilt = -pitch * 5;

  return (
    <svg viewBox="0 0 100 100" width="96" height="96" style={S}>
      <g fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.7"
        transform={`translate(0, ${tilt})`}>
        <path d="M 32 50 C 30 30 42 16 54 16 C 66 16 76 28 74 50" />
        <path d="M 32 50 C 32 64 40 74 50 76" />
        <path d="M 74 50 C 74 64 66 74 56 76" />

        <circle cx="43" cy="38" r="2.5" fill={color} />
        <circle cx="61" cy="38" r="2.5" fill={color} />

        <ellipse cx="52" cy="56" rx={3 + pitch} ry={4 + pitch * 4} fill="none" stroke={color} strokeWidth="1.8" />
      </g>

      <g opacity="0.35">
        <path d={`M 12 90 Q 30 ${90 - pitch * 40} 50 ${90 - pitch * 50} Q 70 ${90 - pitch * 40} 88 90`}
          fill="none" stroke={color} strokeWidth="1" />
        <circle cx={12 + progress * 76} cy={90 - pitch * 48} r="3" fill={color} opacity="0.45">
          <animate attributeName="r" values="2.5;4;2.5" dur="0.8s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}

export function StaccatoIllustration({ progress, color }: IllustrationProps) {
  const burstPhase = (progress * 8) % 1;
  const isBurst = burstPhase < 0.2;
  const pop = isBurst ? (1 - burstPhase * 5) : 0;

  return (
    <svg viewBox="0 0 100 100" width="96" height="96" style={S}>
      <g fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
        <path d="M 32 50 C 30 30 42 16 54 16 C 66 16 76 28 74 50" />
        <path d="M 32 50 C 32 64 40 74 50 76" />
        <path d="M 74 50 C 74 64 66 74 56 76" />

        <circle cx="43" cy="38" r="2.5" fill={color} />
        <circle cx="61" cy="38" r="2.5" fill={color} />

        <circle cx="52" cy="56" r={isBurst ? 5 : 3} fill="none" stroke={color} strokeWidth="1.8"
          style={{ transition: 'r 50ms ease-out' }} />
      </g>

      {isBurst && (
        <g opacity={pop * 0.5} stroke={color} strokeWidth="1.2" strokeLinecap="round">
          <line x1="60" y1="52" x2={60 + pop * 10} y2={48 - pop * 4} />
          <line x1="62" y1="56" x2={62 + pop * 12} y2="56" />
          <line x1="60" y1="60" x2={60 + pop * 10} y2={64 + pop * 4} />
        </g>
      )}
    </svg>
  );
}

export function SustainBodyIllustration({ progress, color }: IllustrationProps) {
  return (
    <svg viewBox="0 0 100 100" width="96" height="96" style={S}>
      <g fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
        <path d="M 50 22 C 50 22 44 24 43 30" />
        <path d="M 50 22 C 50 22 56 24 57 30" />
        <circle cx="46" cy="18" r="2" fill={color} />
        <circle cx="55" cy="17" r="2" fill={color} />
        <path d="M 48 25 Q 51 27 54 25" />

        <path d="M 43 30 C 40 34 36 42 34 54 C 34 62 38 70 44 78" />
        <path d="M 57 30 C 60 34 64 42 66 54 C 66 62 62 70 56 78" />

        <path d="M 43 30 L 30 42" strokeWidth="1.2" />
        <path d="M 57 30 L 70 42" strokeWidth="1.2" />
      </g>

      <g>
        <circle cx="50" cy="55" r="18" fill="none" stroke={color} strokeWidth="1.2" opacity="0.15" />
        <circle cx="50" cy="55" r="18" fill="none" stroke={color} strokeWidth="2"
          strokeDasharray={`${progress * 113} ${113 - progress * 113}`}
          strokeLinecap="round"
          transform="rotate(-90 50 55)"
          opacity="0.5"
        />
        <text x="50" y="59" textAnchor="middle" fill={color} fontSize="10" fontWeight="700" fontFamily="Manrope, sans-serif" opacity="0.55">
          {Math.round(progress * 100)}%
        </text>
      </g>
    </svg>
  );
}
