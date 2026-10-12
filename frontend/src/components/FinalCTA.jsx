import React, { useState } from 'react';
import { ArrowRight, Terminal, Check, Copy, Sparkles, ShieldCheck } from 'lucide-react';

export default function FinalCTA({ onOpenDeploy }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText('curl -fsSL https://shipstack.dev/install.sh | bash');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="final-cta-section" aria-label="Closing Call To Action">
      <div className="container">
        
        <div className="final-cta-card glass-card">
          <div className="cta-ambient-glow"></div>

          <div className="cta-content text-center">
            <span className="badge badge-ai mb-3">
              <Sparkles size={13} />
              <span>Ready for Modern Cloud Hosting?</span>
            </span>

            <h2 className="cta-headline">
              Deploy Your First Application in 60 Seconds.{' '}
              <span className="gradient-text-ai">Let AI Handle The Rest.</span>
            </h2>

            <p className="cta-subheading">
              Join thousands of engineers deploying web applications and AI products on ShipStack. 
              Get global edge performance, zero-config builds, and autonomous RAG diagnostic healing.
            </p>

            {/* Action Buttons */}
            <div className="cta-button-group">
              <button 
                type="button" 
                className="btn-primary cta-btn-large"
                onClick={onOpenDeploy}
              >
                <span>Start Deploying Free</span>
                <ArrowRight size={16} />
              </button>

              <div className="cta-cli-wrapper">
                <div className="cli-snippet mono">
                  <span className="cli-prompt">$</span>
                  <span>curl -fsSL https://shipstack.dev/install.sh | bash</span>
                </div>
                <button 
                  type="button" 
                  className="cli-copy-btn"
                  onClick={handleCopy}
                  title="Copy install command"
                  aria-label="Copy CLI install command"
                >
                  {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Seals & Assurance */}
            <div className="cta-assurance-row">
              <div className="assurance-item">
                <ShieldCheck size={14} color="#10b981" />
                <span>No Credit Card Required</span>
              </div>
              <div className="assurance-divider">•</div>
              <div className="assurance-item">
                <span>100 Free AI Build Diagnoses / Month</span>
              </div>
              <div className="assurance-divider">•</div>
              <div className="assurance-item">
                <span>SOC2 Type II & GDPR Compliant</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
