import React from 'react';

export function GithubIcon({ size = 16, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export function TwitterIcon({ size = 16, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      {...props}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function LinkedinIcon({ size = 16, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

export function YoutubeIcon({ size = 16, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <polygon points="10 15 15 12 10 9 10 15" />
    </svg>
  );
}

export function GitHubMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#e6edf3" aria-hidden="true">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.3 11.3 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z" />
    </svg>
  );
}

export function AmazonSqsLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="8" fill="#FF9900" />
      <rect x="13" y="13" width="22" height="7" rx="1.6" fill="#fff" />
      <rect x="16" y="21" width="22" height="7" rx="1.6" fill="#fff" opacity="0.75" />
      <rect x="19" y="29" width="22" height="7" rx="1.6" fill="#fff" opacity="0.5" />
    </svg>
  );
}

export function AwsEcsLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="8" fill="#FF9900" />
      <rect x="15" y="14" width="18" height="20" rx="2" fill="#fff" />
      <path fill="#FF9900" d="M15 20h18v2H15zm0 6h18v2H15z" />
    </svg>
  );
}

export function AmazonS3Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="8" fill="#569A31" />
      <path
        fill="#fff"
        d="M15 18c0-3.3 4-6 9-6s9 2.7 9 6v14c0 3.3-4 6-9 6s-9-2.7-9-6V18zm2.2 0c0 2 3.1 3.8 6.8 3.8s6.8-1.8 6.8-3.8S27.7 14.2 24 14.2 17.2 16 17.2 18z"
      />
    </svg>
  );
}

export function RagLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="8" fill="#5B21B6" />
      <rect x="14" y="13" width="20" height="22" rx="2" fill="#F3E8FF" />
      <path stroke="#7C3AED" strokeWidth="2" d="M18 19h12M18 24h12M18 29h8" />
    </svg>
  );
}

export function KafkaLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="8" fill="#231F20" />
      <circle cx="18" cy="24" r="4" fill="#E87D19" />
      <circle cx="32" cy="14" r="3" fill="#E87D19" />
      <circle cx="32" cy="24" r="3" fill="#E87D19" />
      <circle cx="32" cy="34" r="3" fill="#E87D19" />
      <path stroke="#E87D19" strokeWidth="2" d="M22 24h7M21 22l8-7M21 26l8 7" />
    </svg>
  );
}

export function ClickHouseLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="8" fill="#161517" />
      <rect x="14" y="12" width="5" height="24" rx="1.5" fill="#FFCC00" />
      <rect x="22" y="12" width="5" height="24" rx="1.5" fill="#FFCC00" />
      <rect x="30" y="12" width="5" height="16" rx="1.5" fill="#FFCC00" />
    </svg>
  );
}

export function AiRagLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="8" fill="#6D28D9" />
      <path
        fill="#F5D0FE"
        d="M24 12l2.1 6.4H33l-5.4 4 2.1 6.4L24 24.8l-5.7 4 2.1-6.4-5.4-4h6.9z"
      />
    </svg>
  );
}

export function ReverseProxyLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="8" fill="#0E7490" />
      <circle cx="24" cy="24" r="10" fill="none" stroke="#A5F3FC" strokeWidth="2.2" />
      <ellipse cx="24" cy="24" rx="4.5" ry="10" fill="none" stroke="#A5F3FC" strokeWidth="2" />
      <path stroke="#A5F3FC" strokeWidth="2" d="M14 24h20M17 18h14M17 30h14" />
    </svg>
  );
}

export function LiveSiteLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="8" fill="#059669" />
      <rect x="16" y="22" width="16" height="12" rx="2" fill="#ECFDF5" />
      <path
        fill="none"
        stroke="#ECFDF5"
        strokeWidth="2.4"
        d="M19 22v-4a5 5 0 0 1 10 0v4"
      />
    </svg>
  );
}
