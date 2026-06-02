import React from 'react';
import { motion } from 'motion/react';
import { UserProfile } from '../lib/permissions';
import { AuthUser } from '../lib/auth';
import { Circle, Layers3, BadgeCheck, ShieldCheck, CheckCircle, Info, HelpCircle } from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  nameEs: string;
  description: string;
  descriptionEs: string;
  price: string;
  priceEs: string;
  features: string[];
  featuresEs: string[];
  isRecommended: boolean;
}

const PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    nameEs: 'Gratis',
    description: 'Perfect for getting started with standard musical creation.',
    descriptionEs: 'Perfecto para comenzar con la creación musical estándar.',
    price: 'Coming soon',
    priceEs: 'Próximamente',
    features: [
      'Basic access to all sub-apps',
      'Local projects and history',
      'Standard MIDI and PDF exports',
      'Community features and updates',
    ],
    featuresEs: [
      'Acceso básico a todas las sub-apps',
      'Proyectos locales e historial',
      'Exportaciones estándar de MIDI y PDF',
      'Funciones y actualizaciones de la comunidad',
    ],
    isRecommended: false,
  },
  {
    id: 'core',
    name: 'Core',
    nameEs: 'Core',
    description: 'Unlock advanced features and priority processing for your setlist.',
    descriptionEs: 'Desbloquea funciones avanzadas y procesamiento prioritario para tu setlist.',
    price: 'Coming soon',
    priceEs: 'Próximamente',
    features: [
      'Expanded project cloud storage',
      'Advanced chord and progression tools',
      'Priority OTA update channel access',
      'Unlimited high-fidelity exports',
    ],
    featuresEs: [
      'Almacenamiento en la nube ampliado',
      'Herramientas avanzadas de acordes',
      'Acceso prioritario a actualizaciones',
      'Exportaciones ilimitadas en alta fidelidad',
    ],
    isRecommended: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    nameEs: 'Pro',
    description: 'The ultimate production suite for professional artists.',
    descriptionEs: 'La suite de producción definitiva para artistas profesionales.',
    price: 'Coming soon',
    priceEs: 'Próximamente',
    features: [
      'Full Studio production toolkit',
      'Advanced multi-track audio exports',
      'Premium sounds, samples and themes',
      'Early access to experimental tools',
    ],
    featuresEs: [
      'Suite de producción Studio completa',
      'Exportación de audio multipista',
      'Sonidos, samples y temas premium',
      'Acceso anticipado a herramientas nuevas',
    ],
    isRecommended: false,
  },
];

interface Props {
  accent: {
    from: string;
    to: string;
    mid: string;
  };
  lang?: 'en' | 'es' | string;
  profile?: UserProfile | null;
  user?: AuthUser | null;
  onShowToast?: (msg: string) => void;
}

export default function StudioPricingSection({ accent, lang = 'en', profile, user, onShowToast }: Props) {
  const isEs = lang === 'es';

  const getPlanStatus = (planId: string): 'active' | 'admin_bypass' | 'included' | 'downgraded' | 'available' => {
    if (!profile) {
      return planId === 'free' ? 'active' : 'available';
    }

    const role = profile.role;
    const isPremiumValid = profile.subscriptionStatus === 'active' || profile.subscriptionStatus === 'past_due';

    if (role === 'admin') {
      return 'admin_bypass';
    }

    if (planId === 'free') {
      return (role === 'free' || !isPremiumValid) ? 'active' : 'downgraded';
    }

    if (planId === 'core') {
      return (isPremiumValid && role === 'core') ? 'active' : (isPremiumValid && role === 'pro' ? 'included' : 'available');
    }

    if (planId === 'pro') {
      return (isPremiumValid && role === 'pro') ? 'active' : 'available';
    }

    return 'available';
  };

  const handleCheckout = (planId: string) => {
    const msg = isEs
      ? '¡Próximamente! La pasarela de pago y facturación se está finalizando. Los administradores pueden omitir las restricciones agregando su UID en adminConfig.ts.'
      : 'Coming Soon! Checkout and billing flows are currently being finalized. Admins can bypass restrictions immediately by adding their UID to code configuration.';
    onShowToast?.(msg);
  };

  return (
    <div style={{ width: '100%', fontFamily: 'Inter, sans-serif' }}>
      {/* ── Section Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h3
          style={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: '1.6rem',
            color: 'var(--c-text-primary)',
            letterSpacing: '-0.02em',
            margin: '0 0 6px',
          }}
        >
          {isEs ? 'Elige tu plan de Studio' : 'Choose Your Studio Plan'}
        </h3>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--c-text-secondary)',
            maxWidth: '380px',
            margin: '0 auto',
            lineHeight: 1.5,
          }}
        >
          {isEs
            ? 'Potencia tu flujo creativo con herramientas avanzadas y almacenamiento en la nube.'
            : 'Power up your creative workflow with advanced tools and cloud-backed synchronization.'}
        </p>
      </div>

      {/* ── Pricing Tiers Grid ── */}
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-5"
        style={{
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {PLANS.map((plan) => {
          const planName = isEs ? plan.nameEs : plan.name;
          const planDesc = isEs ? plan.descriptionEs : plan.description;
          const planPrice = isEs ? plan.priceEs : plan.price;
          const planFeatures = isEs ? plan.featuresEs : plan.features;

          return (
            <motion.div
              key={plan.id}
              whileHover={{ y: -4, scale: 1.015 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
              style={{
                background: plan.isRecommended
                  ? 'var(--app-surface-highest, rgba(128,128,128,0.12))'
                  : 'var(--app-surface-high, rgba(128,128,128,0.06))',
                borderRadius: 20,
                border: plan.isRecommended
                  ? `2px solid ${accent.from}`
                  : '1px solid rgba(128,128,128,0.12)',
                padding: '24px 20px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxShadow: plan.isRecommended
                  ? `0 10px 30px color-mix(in srgb, ${accent.from} 15%, transparent)`
                  : '0 4px 12px rgba(0,0,0,0.1)',
                transition: 'background-color 700ms cubic-bezier(0.4, 0, 0.2, 1), border-color 700ms cubic-bezier(0.4, 0, 0.2, 1)',
                boxSizing: 'border-box',
              }}
            >
              {/* ── Recommended Floating Badge ── */}
              {plan.isRecommended && (
                <div
                  style={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                    color: 'white',
                    padding: '3px 12px',
                    borderRadius: 9999,
                    fontSize: '10px',
                    fontWeight: 800,
                    fontFamily: 'Manrope',
                    letterSpacing: '0.08em',
                    boxShadow: `0 4px 12px color-mix(in srgb, ${accent.to} 35%, transparent)`,
                  }}
                >
                  {isEs ? 'RECOMENDADO' : 'RECOMMENDED'}
                </div>
              )}

              {/* ── Plan Header info ── */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {plan.id === 'free' && <Circle size={18} color="#94a3b8" style={{ strokeWidth: 2.2, flexShrink: 0 }} />}
                  {plan.id === 'core' && <Layers3 size={18} color="#3b82f6" style={{ strokeWidth: 2.2, flexShrink: 0 }} />}
                  {plan.id === 'pro' && <BadgeCheck size={18} color="#a855f7" style={{ strokeWidth: 2.2, flexShrink: 0 }} />}
                  <p
                    style={{
                      fontFamily: 'Manrope',
                      fontWeight: 800,
                      fontSize: '1.25rem',
                      color: 'var(--c-text-primary)',
                      margin: 0,
                    }}
                  >
                    {planName}
                  </p>
                </div>
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--c-text-secondary)',
                    marginTop: 6,
                    lineHeight: 1.4,
                    minHeight: 34,
                  }}
                >
                  {planDesc}
                </p>
              </div>

              {/* ── Divider ── */}
              <div
                style={{
                  height: 1,
                  background: 'rgba(128,128,128,0.12)',
                  marginBottom: 16,
                  borderStyle: 'dashed',
                  borderWidth: '0 0 1px 0',
                }}
              />

              {/* ── Pricing / Cost ── */}
              <div style={{ marginBottom: 20 }}>
                <span
                  style={{
                    fontFamily: 'Manrope',
                    fontWeight: 900,
                    fontSize: '1.6rem',
                    color: plan.isRecommended ? accent.from : 'var(--c-text-primary)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {planPrice}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--c-text-secondary)',
                    marginLeft: 4,
                  }}
                >
                  {isEs ? '/ mes' : '/ month'}
                </span>
              </div>

              {/* ── Feature Checklist ── */}
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '0 0 24px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  flex: 1,
                }}
              >
                {planFeatures.map((feat, idx) => (
                  <li
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      fontSize: '12.5px',
                      color: 'var(--c-text-primary)',
                      lineHeight: 1.4,
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: 16,
                        color: plan.isRecommended ? accent.from : 'var(--c-text-secondary)',
                        flexShrink: 0,
                        marginTop: 1,
                        opacity: plan.isRecommended ? 1 : 0.7,
                      }}
                    >
                      check_circle
                    </span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              {/* ── CTA Button ── */}
              {(() => {
                const status = getPlanStatus(plan.id);
                let btnText = isEs ? 'Elegir Plan' : 'Select Plan';
                let btnStyle: React.CSSProperties = {
                  width: '100%',
                  height: 40,
                  borderRadius: 12,
                  fontFamily: 'Manrope',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  transition: 'all 200ms ease',
                };
                let IconComp: React.ComponentType<any> | null = null;
                const iconSize = 14;

                if (status === 'active') {
                  btnText = isEs ? 'Plan Activo' : 'Active Plan';
                  IconComp = CheckCircle;
                  btnStyle = {
                    ...btnStyle,
                    border: `1.5px solid #10b981`,
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    cursor: 'default',
                  };
                } else if (status === 'admin_bypass') {
                  btnText = isEs ? 'Acceso de Admin' : 'Admin Active';
                  IconComp = ShieldCheck;
                  btnStyle = {
                    ...btnStyle,
                    border: '1px solid #ef4444',
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#ef4444',
                    cursor: 'default',
                  };
                } else if (status === 'included') {
                  btnText = isEs ? 'Incluido en Pro' : 'Included in Pro';
                  IconComp = BadgeCheck;
                  btnStyle = {
                    ...btnStyle,
                    border: '1px solid rgba(128,128,128,0.18)',
                    background: 'var(--app-surface-lowest, rgba(128,128,128,0.04))',
                    color: 'var(--c-text-secondary)',
                    cursor: 'default',
                    opacity: 0.8,
                  };
                } else if (status === 'downgraded') {
                  btnText = isEs ? 'Bajar de Plan' : 'Downgrade';
                  IconComp = Info;
                  btnStyle = {
                    ...btnStyle,
                    border: '1px solid rgba(128,128,128,0.18)',
                    background: 'var(--app-surface-lowest, rgba(128,128,128,0.04))',
                    color: 'var(--c-text-secondary)',
                  };
                } else {
                  // available / upgrade
                  btnText = isEs ? 'Suscribirse' : 'Subscribe';
                  if (plan.id === 'core') IconComp = Layers3;
                  else if (plan.id === 'pro') IconComp = BadgeCheck;
                  else IconComp = Circle;
                  
                  btnStyle = {
                    ...btnStyle,
                    border: plan.isRecommended ? 'none' : '1px solid rgba(128,128,128,0.18)',
                    background: plan.isRecommended
                      ? `linear-gradient(135deg, ${accent.from}, ${accent.to})`
                      : 'var(--app-surface-lowest, rgba(128,128,128,0.04))',
                    color: plan.isRecommended ? 'white' : 'var(--c-text-primary)',
                    boxShadow: plan.isRecommended
                      ? `0 4px 14px color-mix(in srgb, ${accent.to} 20%, transparent)`
                      : 'none',
                  };
                }

                const isInteractive = status === 'available' || status === 'downgraded';

                return (
                  <button
                    type="button"
                    onClick={isInteractive ? () => handleCheckout(plan.id) : undefined}
                    style={btnStyle}
                    className={isInteractive ? 'hover-scale' : undefined}
                  >
                    {IconComp && <IconComp size={iconSize} style={{ strokeWidth: 2.2 }} />}
                    {btnText}
                  </button>
                );
              })()}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
