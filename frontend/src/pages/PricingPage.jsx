import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  ArrowUpRight,
  ArrowRight,
  Check,
  Sparkles,
  Zap,
  Building2,
  Shield,
  Globe,
  GitBranch,
  FileText,
  Cpu,
} from 'lucide-react';
import { GithubIcon, LinkedinIcon } from '../components/BrandIcons';
import '../styles/nebula.css';

const PLANS = [
  {
    id: 'hobby',
    name: 'Hobby',
    eyebrow: 'FOR SIDE PROJECTS',
    price: { monthly: 0, yearly: 0 },
    description: 'Everything you need to experiment, prototype, and ship your first idea.',
    cta: 'Start for free',
    ctaClass: 'btn-explore-ai',
    ctaTo: '/overview',
    accent: '#555',
    features: [
      '3 projects',
      '1 GB build cache',
      '100 deployment minutes / month',
      'Community support',
      'Shared infrastructure',
      'AI Diagnosis (5 diagnoses / month)',
      'Basic log retention (3 days)',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    eyebrow: 'MOST POPULAR',
    price: { monthly: 20, yearly: 16 },
    description: 'For professional developers and growing projects that need more power.',
    cta: 'Get started',
    ctaClass: 'btn-start-building',
    ctaTo: '/overview',
    accent: '#00dfd8',
    highlight: true,
    features: [
      'Unlimited projects',
      '10 GB build cache',
      '1,000 deployment minutes / month',
      'Priority email support',
      'Dedicated build workers',
      'AI Diagnosis (unlimited)',
      '30-day log retention',
      'Free .app or .dev domain (first year)',
      'Custom domains',
      'Deployment webhooks',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    eyebrow: 'FOR TEAMS',
    price: { monthly: 50, yearly: 40 },
    description: 'Collaborate across projects with shared environments and advanced controls.',
    cta: 'Start with Team',
    ctaClass: 'btn-explore-ai',
    ctaTo: '/overview',
    accent: '#c084fc',
    features: [
      'Everything in Pro',
      'Up to 10 team members',
      'Shared project workspaces',
      'Role-based access control',
      'Audit logs',
      'Slack & webhook integrations',
      '90-day log retention',
      'SLA: 99.9% uptime',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    eyebrow: 'CUSTOM',
    price: null,
    description: 'Custom infrastructure, compliance, and dedicated support for large organizations.',
    cta: 'Talk to us',
    ctaClass: 'btn-explore-ai',
    ctaTo: '/about',
    accent: '#f59e0b',
    features: [
      'Everything in Team',
      'Custom member limits',
      'Dedicated infrastructure',
      'SSO / SAML support',
      'Custom data residency',
      'Enterprise SLA',
      'Dedicated onboarding engineer',
      'Custom integrations',
    ],
  },
];

const FAQ = [
  {
    q: 'Can I upgrade or downgrade at any time?',
    a: 'Yes. Plan changes take effect at the start of your next billing cycle. If you upgrade mid-cycle, you\'ll be charged the prorated difference.',
  },
  {
    q: 'What counts as a "deployment minute"?',
    a: 'A deployment minute is wall-clock time your build worker spends running your build pipeline — from source checkout to the final upload of build artifacts.',
  },
  {
    q: 'How does AI Diagnosis work on the Hobby plan?',
    a: 'You get 5 AI diagnoses per month on Hobby. Each diagnosis analyzes your build log, identifies the root cause, and surfaces actionable suggestions grounded in documentation.',
  },
  {
    q: 'Is there a free trial for Pro?',
    a: 'The Hobby plan is free forever and lets you try the core platform. We\'re working on a Pro trial — reach out and we\'ll set one up for you.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit cards via Stripe. Enterprise billing can be arranged via invoice.',
  },
  {
    q: 'What happens if I exceed my deployment minutes?',
    a: 'Your builds will be queued and resume the following month, or you can upgrade your plan to continue immediately.',
  },
];

const COMPARE_ROWS = [
  { feature: 'Projects', hobby: '3', pro: 'Unlimited', team: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'Deployment minutes / mo', hobby: '100', pro: '1,000', team: '5,000', enterprise: 'Custom' },
  { feature: 'Build cache', hobby: '1 GB', pro: '10 GB', team: '50 GB', enterprise: 'Custom' },
  { feature: 'AI Diagnosis', hobby: '5 / mo', pro: 'Unlimited', team: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'Custom domains', hobby: false, pro: true, team: true, enterprise: true },
  { feature: 'Log retention', hobby: '3 days', pro: '30 days', team: '90 days', enterprise: 'Custom' },
  { feature: 'Team members', hobby: '1', pro: '1', team: '10', enterprise: 'Custom' },
  { feature: 'Role-based access', hobby: false, pro: false, team: true, enterprise: true },
  { feature: 'Audit logs', hobby: false, pro: false, team: true, enterprise: true },
  { feature: 'SSO / SAML', hobby: false, pro: false, team: false, enterprise: true },
  { feature: 'SLA', hobby: '—', pro: '—', team: '99.9%', enterprise: 'Custom' },
  { feature: 'Support', hobby: 'Community', pro: 'Email', team: 'Priority', enterprise: 'Dedicated' },
];

function CellValue({ val }) {
  if (val === true) return <Check size={16} style={{ color: '#10b981' }} />;
  if (val === false) return <span style={{ color: '#444' }}>—</span>;
  return <span style={{ color: '#cccccc', fontSize: '13px' }}>{val}</span>;
}

function MarketingHeader() {
  return (
    <header className="marketing-header">
      <div className="marketing-header-inner">
        <Link to="/" className="brand-nebula">
          <Layers size={20} color="#ffffff" />
          <span>ShipStack</span>
        </Link>

        <nav className="marketing-nav">
          <Link to="/overview">Platform</Link>
          <Link to="/diagnosis">AI Diagnosis</Link>
          <Link to="/about">About</Link>
          <Link to="/pricing" className="active">Pricing</Link>
        </nav>

        <div className="marketing-header-actions">
          <Link to="/overview" className="btn-console">
            <span>Open console</span>
            <ArrowUpRight size={14} />
          </Link>
          <Link to="/overview" className="btn-get-started">
            <span>Get started</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-footer-top">
        <div>
          <Link to="/" className="brand-nebula mb-3">
            <Layers size={20} />
            <span>ShipStack</span>
          </Link>
          <p>Built to ship. Designed to scale.</p>
          <span className="footer-preview">
            <i className="status-dot ready"></i> Platform preview
          </span>
        </div>

        <div>
          <h3>Platform</h3>
          <Link to="/overview">Overview</Link>
          <Link to="/deployments">Deployments</Link>
          <Link to="/logs">Logs &amp; Telemetry</Link>
          <Link to="/diagnosis">AI Diagnosis</Link>
        </div>

        <div>
          <h3>Company</h3>
          <Link to="/about">About ShipStack</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/about">Privacy policy</Link>
          <Link to="/about">Terms of service</Link>
        </div>

        <div>
          <h3>Connect</h3>
          <p>support@shipstack.dev</p>
          <p>548 Market St, San Francisco, CA</p>
          <div className="flex-center gap-2 mt-4">
            <a href="https://github.com/DivyanshuRanjanDynamic" target="_blank" rel="noreferrer" className="btn-console">
              <GithubIcon size={16} />
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="btn-console">
              <LinkedinIcon size={16} />
            </a>
          </div>
        </div>
      </div>

      <div className="marketing-footer-bottom">
        <span>© {new Date().getFullYear()} ShipStack</span>
        <span>From first commit to what's next.</span>
        <span className="mono">BUILD / DEPLOY / SCALE</span>
      </div>
    </footer>
  );
}

export default function PricingPage() {
  const [billing, setBilling] = useState('monthly'); // 'monthly' | 'yearly'

  return (
    <div className="marketing-page">
      <MarketingHeader />

      <main>
        {/* Hero */}
        <section className="home-hero" style={{ paddingBottom: '72px' }}>
          <div className="home-hero-copy">
            <span className="hero-announcement" style={{ cursor: 'default' }}>
              <span>
                <Zap size={13} color="#f59e0b" />
                Simple, transparent pricing
              </span>
              <ArrowRight size={14} />
            </span>

            <h1 style={{ fontSize: '48px' }}>
              Pay for what you use.<br />
              Scale when you're ready.
            </h1>

            <p>
              Start free and grow into the plan that fits your project. No hidden fees,
              no lock-in, and no surprise invoices at the end of the month.
            </p>

            {/* Billing toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => setBilling('monthly')}
                style={{
                  padding: '6px 16px',
                  borderRadius: '999px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: billing === 'monthly' ? '1px solid rgba(255,255,255,0.25)' : '1px solid transparent',
                  background: billing === 'monthly' ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: billing === 'monthly' ? '#fff' : '#666',
                  transition: 'all 0.15s',
                }}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBilling('yearly')}
                style={{
                  padding: '6px 16px',
                  borderRadius: '999px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: billing === 'yearly' ? '1px solid rgba(255,255,255,0.25)' : '1px solid transparent',
                  background: billing === 'yearly' ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: billing === 'yearly' ? '#fff' : '#666',
                  transition: 'all 0.15s',
                }}
              >
                Yearly
              </button>
              {billing === 'yearly' && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#10b981',
                    background: 'rgba(16,185,129,0.12)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: '999px',
                    padding: '2px 10px',
                  }}
                >
                  Save 20%
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 24px 96px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
            }}
          >
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                style={{
                  background: plan.highlight ? 'rgba(0,223,216,0.04)' : '#0a0a0a',
                  border: plan.highlight
                    ? '1px solid rgba(0,223,216,0.35)'
                    : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '28px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  boxShadow: plan.highlight ? '0 0 40px rgba(0,223,216,0.06)' : 'none',
                }}
              >
                {plan.highlight && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#00dfd8',
                      color: '#000',
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.8px',
                      padding: '3px 12px',
                      borderRadius: '999px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    MOST POPULAR
                  </span>
                )}

                <span
                  className="marketing-eyebrow"
                  style={{
                    justifyContent: 'flex-start',
                    color: plan.accent,
                    marginBottom: '12px',
                  }}
                >
                  {plan.eyebrow}
                </span>

                <h2
                  style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    color: '#fff',
                    marginBottom: '6px',
                  }}
                >
                  {plan.name}
                </h2>

                <div style={{ marginBottom: '16px' }}>
                  {plan.price ? (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '36px', fontWeight: 800, color: '#fff' }}>
                        ${billing === 'yearly' ? plan.price.yearly : plan.price.monthly}
                      </span>
                      <span style={{ fontSize: '13px', color: '#666' }}>/mo</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '24px', fontWeight: 700, color: '#fff' }}>Custom</span>
                  )}
                  {billing === 'yearly' && plan.price && plan.price.yearly > 0 && (
                    <span style={{ fontSize: '11px', color: '#10b981' }}>
                      Billed ${plan.price.yearly * 12}/yr
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '13px', color: '#888', lineHeight: 1.55, marginBottom: '24px', flexGrow: 0 }}>
                  {plan.description}
                </p>

                <Link
                  to={plan.ctaTo}
                  className={plan.ctaClass}
                  style={{
                    marginBottom: '28px',
                    justifyContent: 'center',
                    height: '38px',
                    ...(plan.highlight
                      ? { background: '#00dfd8', color: '#000', border: 'none' }
                      : {}),
                  }}
                >
                  <span>{plan.cta}</span>
                  <ArrowUpRight size={14} />
                </Link>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#cccccc' }}>
                      <Check size={14} style={{ color: '#10b981', marginTop: '2px', flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Feature comparison table */}
        <section
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '80px 24px',
          }}
        >
          <span className="marketing-eyebrow">FULL COMPARISON</span>
          <h2
            style={{
              fontSize: '32px',
              fontWeight: 700,
              letterSpacing: '-0.8px',
              color: '#fff',
              margin: '12px 0 44px',
            }}
          >
            All features, side by side.
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px',
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      color: '#666',
                      fontWeight: 500,
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      width: '30%',
                    }}
                  >
                    Feature
                  </th>
                  {PLANS.map((p) => (
                    <th
                      key={p.id}
                      style={{
                        padding: '12px 16px',
                        color: p.highlight ? '#00dfd8' : '#888',
                        fontWeight: 600,
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        textAlign: 'center',
                      }}
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <tr
                    key={row.feature}
                    style={{
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                    }}
                  >
                    <td
                      style={{
                        padding: '12px 16px',
                        color: '#cccccc',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      {row.feature}
                    </td>
                    {(['hobby', 'pro', 'team', 'enterprise']).map((k) => (
                      <td
                        key={k}
                        style={{
                          padding: '12px 16px',
                          textAlign: 'center',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <CellValue val={row[k]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            maxWidth: '800px',
            margin: '0 auto',
            padding: '80px 24px',
          }}
        >
          <span className="marketing-eyebrow">COMMON QUESTIONS</span>
          <h2
            style={{
              fontSize: '32px',
              fontWeight: 700,
              letterSpacing: '-0.8px',
              color: '#fff',
              margin: '12px 0 44px',
            }}
          >
            Frequently asked.
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {FAQ.map((item) => (
              <div
                key={item.q}
                style={{
                  background: '#0a0a0a',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  padding: '22px 24px',
                }}
              >
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '10px' }}>
                  {item.q}
                </h3>
                <p style={{ fontSize: '13px', color: '#888', lineHeight: 1.6, margin: 0 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="closing-cta">
          <span className="marketing-eyebrow">YOUR NEXT IDEA DESERVES TO SHIP</span>
          <h2>Start for free. Upgrade when ready.</h2>
          <p>No credit card required. Set up your first project in minutes.</p>
          <div className="marketing-cta-row">
            <Link to="/overview" className="btn-start-building">
              <span>Get started free</span>
              <ArrowUpRight size={15} />
            </Link>
            <Link to="/about" className="btn-explore-ai">
              <span>Talk to us</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
