import React from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  GitBranch,
  Globe,
  Check,
  Users,
  Rocket,
  Heart,
  Code,
  Cpu,
  Terminal,
  Mail,
  MapPin,
} from 'lucide-react';
import { GithubIcon, LinkedinIcon } from '../components/BrandIcons';
import '../styles/nebula.css';

const TEAM = [
  {
    name: 'Divyanshu Ranjan',
    role: 'Founder & Lead Engineer',
    bio: 'Full-stack engineer passionate about developer tooling, AI-powered workflows, and making infrastructure invisible.',
    emoji: 'DR',
    accent: '#c084fc',
    github: 'https://github.com/DivyanshuRanjanDynamic',
    linkedin: 'https://linkedin.com',
  },
];

const VALUES = [
  {
    icon: Rocket,
    label: 'Ship fast',
    body: 'We believe the distance from idea to working application should be as short as possible. Every hour saved is an idea shipped.',
  },
  {
    icon: Heart,
    label: 'Developer first',
    body: 'Tooling built with empathy. We\'re developers building for developers — no marketing fluff, just tools that work.',
  },
  {
    icon: Cpu,
    label: 'AI-native',
    body: 'Intelligence isn\'t an add-on. Diagnosis, context, and smart suggestions are baked into every deployment workflow.',
  },
  {
    icon: Globe,
    label: 'Open by default',
    body: 'Transparent APIs, observable logs, and honest pricing. We believe in platforms you can understand end to end.',
  },
];

const MILESTONES = [
  { year: '2024', label: 'Project started', desc: 'ShipStack began as a side-project to simplify ECS deployments.' },
  { year: '2025', label: 'AI Diagnosis', desc: 'Integrated Kafka log streaming with LLM-powered failure analysis.' },
  { year: '2025', label: 'Platform preview', desc: 'Full platform preview launched with S3 reverse proxy and ClickHouse telemetry.' },
  { year: '2026', label: 'Today', desc: 'Continuously refining the console, diagnosis, and deployment experience.' },
];

function MarketingHeader() {
  return (
    <header className="marketing-header">
      <div className="marketing-header-inner">
        <Link to="/marketing" className="brand-nebula">
          <Layers size={20} color="#ffffff" />
          <span>ShipStack</span>
        </Link>

        <nav className="marketing-nav">
          <Link to="/overview">Platform</Link>
          <Link to="/diagnosis">AI Diagnosis</Link>
          <Link to="/about" className="active">About</Link>
          <Link to="/pricing">Pricing</Link>
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
          <Link to="/marketing" className="brand-nebula mb-3">
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

export default function AboutPage() {
  return (
    <div className="marketing-page">
      <MarketingHeader />

      <main>
        {/* Hero */}
        <section className="home-hero" style={{ paddingBottom: '80px' }}>
          <div className="home-hero-copy">
            <span className="hero-announcement" style={{ cursor: 'default' }}>
              <span>
                <Sparkles size={13} color="#c084fc" />
                Platform preview · Built by developers
              </span>
              <ArrowRight size={14} />
            </span>

            <h1 style={{ fontSize: '48px' }}>
              We're building the platform<br />
              we always wanted.
            </h1>

            <p>
              ShipStack was born from frustration with fragmented tooling.
              We're a small team on a big mission: make deployment invisible
              so developers can focus on what they build, not where it runs.
            </p>

            <div className="marketing-cta-row">
              <Link to="/overview" className="btn-start-building">
                <span>See the platform</span>
                <ArrowUpRight size={15} />
              </Link>
              <Link to="/pricing" className="btn-explore-ai">
                <span>View pricing</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        {/* Mission */}
        <section className="home-story">
          <span className="marketing-eyebrow">OUR MISSION</span>
          <h2>
            Developers should build products.<br />
            <span>Not fight their infrastructure.</span>
          </h2>
          <div className="story-bottom">
            <p>
              We're building ShipStack around a simple belief: the distance from a great idea to a working
              application should be shorter. Developer tools, deployment workflows, and informed diagnosis
              belong together in one coherent platform — not scattered across a dozen dashboards.
              Every decision we make traces back to one question: does this make a developer's day better?
            </p>
            <Link to="/diagnosis" className="text-link">
              <span>Try AI Diagnosis</span>
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>

        {/* Values */}
        <section className="offerings-section">
          <div className="marketing-section-heading">
            <div>
              <span className="marketing-eyebrow">WHAT WE STAND FOR</span>
              <h2>Principles behind the platform.</h2>
            </div>
          </div>

          <div className="offerings-grid">
            {VALUES.map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.label} className="offering" style={{ cursor: 'default' }}>
                  <div className="offering-top">
                    <Icon size={24} />
                  </div>
                  <span className="marketing-eyebrow" style={{ marginBottom: '6px', justifyContent: 'flex-start' }}>
                    {v.label.toUpperCase()}
                  </span>
                  <h3>{v.label}</h3>
                  <p>{v.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Timeline */}
        <section
          className="home-proof"
          style={{ display: 'block', borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px' }}>
            <span className="marketing-eyebrow">THE STORY SO FAR</span>
            <h2 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.8px', color: '#fff', margin: '12px 0 44px', lineHeight: 1.2 }}>
              From side-project to platform.
            </h2>

            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {MILESTONES.map((m, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    gap: '24px',
                    background: '#0a0a0a',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '20px 24px',
                    alignItems: 'flex-start',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#555',
                      whiteSpace: 'nowrap',
                      paddingTop: '2px',
                      minWidth: '38px',
                    }}
                  >
                    {m.year}
                  </span>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>{m.label}</h3>
                    <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>{m.desc}</p>
                  </div>
                  {i === MILESTONES.length - 1 && (
                    <span style={{ marginLeft: 'auto' }}>
                      <i className="status-dot ready"></i>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Team */}
        <section
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '80px 24px',
          }}
        >
          <span className="marketing-eyebrow">THE TEAM</span>
          <h2
            style={{
              fontSize: '32px',
              fontWeight: 700,
              letterSpacing: '-0.8px',
              color: '#fff',
              margin: '12px 0 44px',
            }}
          >
            Small team. Big ambitions.
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '20px',
            }}
          >
            {TEAM.map((member) => (
              <div
                key={member.name}
                style={{
                  background: '#0a0a0a',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '28px',
                }}
              >
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '12px',
                    background: `linear-gradient(135deg, ${member.accent}22, ${member.accent}44)`,
                    border: `1px solid ${member.accent}44`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '16px',
                    color: member.accent,
                    marginBottom: '16px',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {member.emoji}
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>{member.name}</h3>
                <p style={{ fontSize: '12px', color: member.accent, marginBottom: '12px', fontWeight: 500 }}>{member.role}</p>
                <p style={{ fontSize: '13px', color: '#888', lineHeight: 1.6, marginBottom: '20px' }}>{member.bio}</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a href={member.github} target="_blank" rel="noreferrer" className="btn-console" style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}>
                    <GithubIcon size={14} />
                  </a>
                  <a href={member.linkedin} target="_blank" rel="noreferrer" className="btn-console" style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}>
                    <LinkedinIcon size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact CTA */}
        <section className="closing-cta">
          <span className="marketing-eyebrow">
            <Mail size={13} />
            GET IN TOUCH
          </span>
          <h2>Want to work together?</h2>
          <p>We're always open to collaborators, feedback, and good conversations about developer tooling.</p>
          <div className="marketing-cta-row">
            <a href="mailto:support@shipstack.dev" className="btn-start-building">
              <span>Send us a message</span>
              <ArrowUpRight size={15} />
            </a>
            <a href="https://github.com/DivyanshuRanjanDynamic" target="_blank" rel="noreferrer" className="btn-explore-ai">
              <span>Follow on GitHub</span>
              <GithubIcon size={14} />
            </a>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
