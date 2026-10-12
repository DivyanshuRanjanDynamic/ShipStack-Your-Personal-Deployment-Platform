import React, { useState } from 'react';
import { 
  Layers, 
  Sparkles, 
  Terminal, 
  BookOpen, 
  DollarSign, 
  ExternalLink, 
  Menu, 
  X,
  ChevronRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { GithubIcon } from './BrandIcons';

export default function Navbar({ onOpenDeploy }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="navbar-wrapper">
      <div className="container navbar-inner">
        {/* Brand Logo - Top-Left Clickable back to homepage */}
        <a href="#" className="brand-logo" aria-label="ShipStack Home">
          <div className="brand-icon-wrapper">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 2L28 9L16 16L4 9L16 2Z" fill="url(#nav-brand-grad)" />
              <path d="M4 14L16 21L28 14L28 18L16 25L4 18L4 14Z" fill="#ffffff" fillOpacity="0.88" />
              <path d="M4 21L16 28L28 21L28 24L16 31L4 24L4 21Z" fill="#00dfd8" fillOpacity="0.65" />
              <defs>
                <linearGradient id="nav-brand-grad" x1="4" y1="2" x2="28" y2="16" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#0070f3" />
                  <stop offset="0.5" stopColor="#00dfd8" />
                  <stop offset="1" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>
            <div className="brand-icon-glow"></div>
          </div>
          <span className="brand-name">
            Ship<span className="brand-accent">Stack</span>
          </span>
          <span className="brand-tag">PaaS + AI</span>
        </a>

        {/* Clean, horizontal menu with no more than 5 primary links */}
        <nav className="desktop-nav" aria-label="Primary Navigation">
          <a href="#platform" className="nav-link">
            <span>Platform</span>
          </a>
          <a href="#ai-diagnosis" className="nav-link nav-link-ai">
            <Sparkles size={14} className="nav-sparkle" />
            <span>AI Diagnosis & RAG</span>
            <span className="nav-pill-badge">New</span>
          </a>
          <a href="#architecture" className="nav-link">
            <span>Infrastructure</span>
          </a>
          <a href="#docs" className="nav-link">
            <span>Docs & API</span>
          </a>
          <a href="#pricing" className="nav-link">
            <span>Pricing</span>
          </a>
        </nav>

        {/* Right Action buttons & status */}
        <div className="nav-actions">
          <div className="status-indicator-pill" title="Kafka, ECS & Reverse Proxy status">
            <span className="pulse-dot"></span>
            <span className="status-text">All Systems Operational</span>
          </div>

          <a 
            href="https://github.com/DivyanshuRanjanDynamic/ShipStack-Your-Personal-Deployment-Platform" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="github-btn"
            aria-label="ShipStack GitHub Repository"
          >
            <GithubIcon size={16} />
            <span className="github-count">★ 2.4k</span>
          </a>

          <button 
            type="button" 
            className="btn-primary nav-cta-btn"
            onClick={onOpenDeploy}
          >
            <span>Start Deploying</span>
            <ChevronRight size={14} />
          </button>

          {/* Mobile hamburger toggle */}
          <button 
            type="button" 
            className="mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="mobile-menu-drawer">
          <div className="container mobile-menu-links">
            <a href="#platform" onClick={() => setMobileMenuOpen(false)}>Platform</a>
            <a href="#ai-diagnosis" onClick={() => setMobileMenuOpen(false)}>
              <span className="flex-center gap-2">
                <Sparkles size={14} color="#c084fc" /> AI Diagnosis & RAG
              </span>
            </a>
            <a href="#architecture" onClick={() => setMobileMenuOpen(false)}>Infrastructure</a>
            <a href="#docs" onClick={() => setMobileMenuOpen(false)}>Docs & API</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <div className="mobile-cta-box">
              <button 
                type="button" 
                className="btn-primary w-full"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenDeploy();
                }}
              >
                Start Deploying Free
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
