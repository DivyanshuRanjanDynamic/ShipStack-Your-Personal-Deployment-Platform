import React from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  GitBranch,
  Globe,
  BookOpen,
  Check,
  Code,
  Cpu,
  Terminal,
  Triangle,
} from 'lucide-react';
import { GithubIcon, LinkedinIcon } from '../components/BrandIcons';
import ArchitectureFlow from '../components/ArchitectureFlow';
import shipstackInfraImg from '../assets/shipstack-infrastructure-DpfR2VNQ.jpg';
import '../styles/nebula.css';

export default function HomePage({ onOpenDeploy }) {
  return (
    <div className="marketing-page">
      {/* Marketing Header */}
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

      {/* Main Home Hero */}
      <main>
        <section className="home-hero">
          <div className="home-hero-copy">
            <Link to="/diagnosis" className="hero-announcement">
              <span>
                <Sparkles size={13} color="#c084fc" />
                Introducing AI deployment diagnosis
              </span>
              <ArrowRight size={14} />
            </Link>

            <h1>
              ShipStack. Build, deploy,<br />
              and scale your next idea.
            </h1>

            <p>
              The cloud application platform for developers building web apps<br className="desktop-break" />
              and AI products. Ship with confidence, not complexity.
            </p>

            <div className="marketing-cta-row">
              <Link to="/overview" className="btn-start-building">
                <span>Start building</span>
                <ArrowUpRight size={15} />
              </Link>
              <Link to="/diagnosis" className="btn-explore-ai">
                <span>Explore AI diagnosis</span>
                <Sparkles size={14} color="#c084fc" />
              </Link>
            </div>

            <span className="hero-demo-note">
              Explore the platform preview · No account required
            </span>
          </div>

          {/* Full-width Hero Infrastructure Graphic */}
          <div className="home-hero-image-wrapper">
            <img
              className="home-hero-image"
              src={shipstackInfraImg}
              alt="Layered ShipStack server processor with blue circuit connections"
              width="2000"
              height="1024"
              loading="eager"
            />

            <div className="hero-image-caption">
              <span><i className="status-dot ready"></i>IDEA → INFRASTRUCTURE</span>
              <span>ONE CONNECTED PLATFORM</span>
            </div>
          </div>
        </section>

        {/* Framework Band */}
        <section className="framework-band">
          <span className="marketing-eyebrow">YOUR FRAMEWORK. YOUR WORKFLOW.</span>
          <div className="framework-logos">
            <span><Triangle size={18} /> Next.js</span>
            <span><Code size={18} /> React</span>
            <span><Terminal size={18} /> Astro</span>
            <span><Layers size={18} /> Nuxt</span>
            <span><Cpu size={18} /> AI products</span>
          </div>
        </section>

        {/* The Platform Offerings Grid */}
        <section className="offerings-section">
          <div className="marketing-section-heading">
            <div>
              <span className="marketing-eyebrow">THE PLATFORM</span>
              <h2>Everything between idea and impact.</h2>
            </div>
            <Link to="/overview" className="text-link">
              <span>Explore ShipStack</span>
              <ArrowUpRight size={16} />
            </Link>
          </div>

          <div className="offerings-grid">
            <Link to="/deployments" className="offering">
              <div className="offering-top">
                <GitBranch size={24} />
                <ArrowUpRight size={16} />
              </div>
              <span className="marketing-eyebrow">01 / DEPLOY</span>
              <h3>From commit to live.</h3>
              <p>A connected workflow for your repositories, builds, and production releases.</p>
            </Link>

            <Link to="/overview" className="offering">
              <div className="offering-top">
                <Globe size={24} />
                <ArrowUpRight size={16} />
              </div>
              <span className="marketing-eyebrow">02 / SCALE</span>
              <h3>Built without borders.</h3>
              <p>A platform vision centered on global serverless infrastructure that grows with your ideas.</p>
            </Link>

            <Link to="/diagnosis" className="offering">
              <div className="offering-top">
                <Sparkles size={24} color="#c084fc" />
                <ArrowUpRight size={16} />
              </div>
              <span className="marketing-eyebrow">03 / DIAGNOSE</span>
              <h3>Errors into answers.</h3>
              <p>Understand what went wrong with AI deployment diagnosis and actionable suggestions.</p>
            </Link>

            <Link to="/knowledge" className="offering">
              <div className="offering-top">
                <BookOpen size={24} />
                <ArrowUpRight size={16} />
              </div>
              <span className="marketing-eyebrow">04 / KNOWLEDGE</span>
              <h3>Context, not guesswork.</h3>
              <p>Ground each suggested solution in relevant documentation and deployment knowledge.</p>
            </Link>
          </div>
        </section>

        <ArchitectureFlow />

        {/* Home Diagnosis Section */}
        <section className="home-diagnosis">
          <div className="diagnosis-pitch">
            <span className="marketing-eyebrow">
              <Sparkles size={13} color="#c084fc" />
              INTELLIGENCE, BUILT IN
            </span>
            <h2>A failed deployment.<br />Not a dead end.</h2>
            <p>
              Turn build logs into a clear next step. ShipStack’s AI diagnosis brings the problem,
              the explanation, and knowledge-backed suggestions into one view.
            </p>
            <ul>
              <li>
                <Check size={18} />
                <span>Pinpoint the underlying problem</span>
              </li>
              <li>
                <Check size={18} />
                <span>Trace suggestions back to their sources</span>
              </li>
              <li>
                <Check size={18} />
                <span>Review the fix before your next deployment</span>
              </li>
            </ul>
            <Link to="/diagnosis" className="btn-explore-ai">
              <span>See diagnosis in action</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Interactive Preview Card as on Nebula Ship AI */}
          <div className="home-diagnosis-preview">
            <div className="preview-toolbar">
              <span>
                <Sparkles size={14} />
                Deployment diagnosis
              </span>
              <span className="mono">EXAMPLE</span>
            </div>

            <div className="preview-log">
              <span>BUILD LOG · AI-ASSISTANT</span>
              <code>
                <span className="log-muted">14:32:08 → Running production build</span><br />
                <span className="log-error">14:32:11 → Missing environment variable</span><br />
                <span className="log-error">Error: OPENAI_API_KEY is not defined</span>
              </code>
            </div>

            <div className="preview-answer">
              <span className="preview-answer-label">
                <Sparkles size={14} />
                ROOT CAUSE IDENTIFIED
              </span>
              <h3>Missing production configuration</h3>
              <p>
                The required environment variable is not available to this build. Add it to the production environment before redeploying.
              </p>

              <div className="preview-source">
                <BookOpen size={14} color="#00dfd8" />
                <span>Source: Environment configuration guide</span>
                <Check size={14} />
              </div>
            </div>

            <Link to="/diagnosis" className="preview-bottom">
              <span>Review suggested solution</span>
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </section>

        {/* Why ShipStack (Brand Story) */}
        <section className="home-story">
          <span className="marketing-eyebrow">WHY SHIPSTACK</span>
          <h2>
            Developers should build products.<br />
            <span>Not fight their infrastructure.</span>
          </h2>
          <div className="story-bottom">
            <p>
              We’re building ShipStack around a simple belief: the distance from a great idea to a working application should be shorter.
              Developer tools, deployment workflows, and informed diagnosis belong together.
            </p>
            <Link to="/about" className="text-link">
              <span>Our story</span>
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>

        {/* See The Workflow */}
        <section className="home-proof">
          <div>
            <span className="marketing-eyebrow">SEE THE WORKFLOW</span>
            <h2>Don’t take our word for it.<br />Take the platform for a spin.</h2>
            <p>
              Explore a sample project, inspect a deployment, and follow a knowledge-backed diagnosis from error to suggested fix.
            </p>
            <Link to="/overview" className="btn-explore-ai">
              <span>Explore the sample workspace</span>
              <ArrowUpRight size={15} />
            </Link>
          </div>

          <ol>
            <li>
              <span>01</span>
              <div>
                <h3>Your project, in one place.</h3>
                <p>Projects and deployments in a shared workspace.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>The problem, explained.</h3>
                <p>Build logs with a focused diagnosis.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>The next step, grounded.</h3>
                <p>Suggested solutions with knowledge sources.</p>
              </div>
            </li>
          </ol>
        </section>

        {/* Closing CTA */}
        <section className="closing-cta">
          <span className="marketing-eyebrow">YOUR NEXT IDEA DESERVES TO SHIP</span>
          <h2>Less friction. More forward.</h2>
          <p>Bring your ambition. Leave the deployment complexity behind.</p>
          <div className="marketing-cta-row">
            <Link to="/overview" className="btn-start-building">
              <span>Get started</span>
              <ArrowUpRight size={15} />
            </Link>
            <Link to="/overview" className="btn-explore-ai">
              <span>Talk to us</span>
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </section>
      </main>

      {/* Marketing Footer */}
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
            <Link to="/logs">Logs & Telemetry</Link>
            <Link to="/diagnosis">AI Diagnosis</Link>
          </div>

          <div>
            <h3>Company</h3>
            <Link to="/about">About ShipStack</Link>
            <Link to="/about">Contact</Link>
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
          <span>From first commit to what’s next.</span>
          <span className="mono">BUILD / DEPLOY / SCALE</span>
        </div>
      </footer>
    </div>
  );
}
