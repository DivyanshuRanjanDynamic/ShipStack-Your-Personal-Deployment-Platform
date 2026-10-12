import React from 'react';
import { 
  Mail, 
  MapPin, 
  ExternalLink,
  ShieldCheck,
  Disc as DiscordIcon
} from 'lucide-react';
import { GithubIcon, TwitterIcon, LinkedinIcon, YoutubeIcon } from './BrandIcons';

export default function Footer() {
  return (
    <footer className="footer-wrapper" aria-label="Footer and Essential Links">
      <div className="container">
        
        {/* Main Footer Links Columns */}
        <div className="footer-links-grid">
          
          {/* Column 1: Brand & Contact Info */}
          <div className="footer-brand-col">
            <div className="brand-logo mb-3">
              <div className="brand-icon-wrapper">
                <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                  <path d="M16 2L28 9L16 16L4 9L16 2Z" fill="#0070f3" />
                  <path d="M4 14L16 21L28 14L28 18L16 25L4 18L4 14Z" fill="#ffffff" fillOpacity="0.88" />
                  <path d="M4 21L16 28L28 21L28 24L16 31L4 24L4 21Z" fill="#00dfd8" fillOpacity="0.65" />
                </svg>
              </div>
              <span className="brand-name">
                Ship<span className="brand-accent">Stack</span>
              </span>
            </div>

            <p className="footer-brand-desc">
              Next-generation cloud application platform with autonomous AI deployment diagnosis and RAG self-healing infrastructure.
            </p>

            <div className="footer-contact-info">
              <div className="contact-row">
                <Mail size={14} className="contact-icon" />
                <a href="mailto:support@shipstack.dev">support@shipstack.dev</a>
              </div>
              <div className="contact-row">
                <MapPin size={14} className="contact-icon" />
                <span>548 Market St, Suite 39201, San Francisco, CA & Bengaluru</span>
              </div>
            </div>

            <div className="footer-status-pill">
              <span className="pulse-dot"></span>
              <span>All Systems Normal • 32 Edge Regions</span>
            </div>
          </div>

          {/* Column 2: Platform & Features */}
          <div className="footer-nav-col">
            <h4 className="footer-heading">Platform</h4>
            <ul className="footer-nav-list">
              <li><a href="#platform">Serverless Runtime</a></li>
              <li><a href="#ai-diagnosis">AI Deployment Diagnosis</a></li>
              <li><a href="#ai-diagnosis">RAG Knowledge Engine</a></li>
              <li><a href="#architecture">AWS ECS Build Server</a></li>
              <li><a href="#architecture">Kafka Log Streaming</a></li>
              <li><a href="#architecture">ClickHouse Storage</a></li>
              <li><a href="#architecture">Dynamic Reverse Proxy</a></li>
            </ul>
          </div>

          {/* Column 3: Developer Resources */}
          <div className="footer-nav-col">
            <h4 className="footer-heading">Resources & Docs</h4>
            <ul className="footer-nav-list">
              <li><a href="#docs">API Documentation</a></li>
              <li><a href="#docs">Protobuf & gRPC Specs</a></li>
              <li><a href="#docs">CLI Tool & GitHub Actions</a></li>
              <li><a href="#docs">Next.js & Vite Guides</a></li>
              <li><a href="#docs">Troubleshooting Database</a></li>
              <li><a href="https://github.com/DivyanshuRanjanDynamic/ShipStack-Your-Personal-Deployment-Platform" target="_blank" rel="noreferrer">Open Source GitHub</a></li>
            </ul>
          </div>

          {/* Column 4: Company & Legal */}
          <div className="footer-nav-col">
            <h4 className="footer-heading">Company & Legal</h4>
            <ul className="footer-nav-list">
              <li><a href="#brand-story">About Our Team</a></li>
              <li><a href="#careers">Careers (We're Hiring)</a></li>
              <li><a href="#privacy">Privacy Policy</a></li>
              <li><a href="#terms">Terms of Service</a></li>
              <li><a href="#security">Security & Compliance</a></li>
              <li><a href="#cookies">Cookie Preferences</a></li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar: Copyright & Social Media Icons */}
        <div className="footer-bottom-bar">
          <div className="footer-copyright">
            © {new Date().getFullYear()} ShipStack Technologies Inc. All rights reserved.
          </div>

          {/* Social Media Icons */}
          <div className="footer-social-links" aria-label="Social Media Links">
            <a href="https://github.com/DivyanshuRanjanDynamic" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <GithubIcon size={18} />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="X (formerly Twitter)">
              <TwitterIcon size={18} />
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <LinkedinIcon size={18} />
            </a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              <YoutubeIcon size={18} />
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}
