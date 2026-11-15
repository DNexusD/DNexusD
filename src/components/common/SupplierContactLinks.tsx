import React from 'react';
import { ExternalLink, Globe, Link2, MessageCircle } from 'lucide-react';
import { SupplierSocialLinks } from '../../types';
import { buildContactLinksList, SocialPlatformKey } from '../../utils/socialLinks';

interface SocialIconProps {
  platform: SocialPlatformKey | 'custom';
  className?: string;
}

export const SocialPlatformIcon: React.FC<SocialIconProps> = ({ platform, className = 'w-3.5 h-3.5' }) => {
  switch (platform) {
    case 'whatsapp':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-emerald-400`} aria-hidden="true">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2m5.81 14.08c-.24.69-1.41 1.32-1.95 1.4-.5.07-1.13.1-1.82-.12-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.18-4.94-4.37-.14-.2-1.18-1.57-1.18-2.99 0-1.43.75-2.13 1.01-2.42.27-.29.58-.36.77-.36h.56c.18 0 .42-.07.66.5.24.58.83 2.02.9 2.17.07.14.12.31.02.51-.1.19-.14.31-.29.48-.15.17-.3.38-.44.51-.14.14-.3.3-.13.59.17.29.76 1.26 1.63 2.04 1.12 1 2.07 1.31 2.36 1.46.29.14.46.12.63-.07.17-.2.73-.85.92-1.14.2-.29.39-.24.66-.15.27.1 1.7.8 1.99.95.29.14.48.22.55.34.08.12.08.7-.16 1.39" />
        </svg>
      );
    case 'telegram':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-sky-400`} aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.62 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.05-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.48 1.02-.73 3.99-1.74 6.65-2.89 7.98-3.44 3.8-1.58 4.59-1.85 5.1-1.86.11 0 .37.03.53.17.14.12.18.28.19.45-.01.07-.01.24-.03.38" />
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-pink-400`} aria-hidden="true">
          <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3" />
        </svg>
      );
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-blue-400`} aria-hidden="true">
          <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02" />
        </svg>
      );
    case 'x':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-slate-200`} aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-rose-400`} aria-hidden="true">
          <path d="M16.6 5.82s.51.5 0 0A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48" />
        </svg>
      );
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-red-400`} aria-hidden="true">
          <path d="M21.58 7.19a2.75 2.75 0 0 0-1.94-1.94C17.93 4.8 12 4.8 12 4.8s-5.93 0-7.64.45a2.75 2.75 0 0 0-1.94 1.94A28.7 28.7 0 0 0 2 12a28.7 28.7 0 0 0 .42 4.81 2.75 2.75 0 0 0 1.94 1.94c1.71.45 7.64.45 7.64.45s5.93 0 7.64-.45a2.75 2.75 0 0 0 1.94-1.94A28.7 28.7 0 0 0 22 12a28.7 28.7 0 0 0-.42-4.81M10 15.05V8.95L15.27 12z" />
        </svg>
      );
    case 'snapchat':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-yellow-300`} aria-hidden="true">
          <path d="M12 2.5c2.9 0 4.8 1.9 4.8 4.8 0 .7-.1 1.4-.2 2 .4-.1.8-.1 1.1.1.3.2.5.6.3 1-.2.4-.7.6-1.2.8.3.9 1.1 1.8 2.4 2.3.4.2.7.5.6.9-.1.4-.5.6-1 .7-.6.1-1.1.3-1.4.6-.2.2-.3.5-.4.8-.1.4-.5.6-1 .5-.7-.1-1.3-.1-2 .1-.6.2-1.2.6-2 .6s-1.4-.4-2-.6c-.7-.2-1.3-.2-2-.1-.5.1-.9-.1-1-.5-.1-.3-.2-.6-.4-.8-.3-.3-.8-.5-1.4-.6-.5-.1-.9-.3-1-.7-.1-.4.2-.7.6-.9 1.3-.5 2.1-1.4 2.4-2.3-.5-.2-1-.4-1.2-.8-.2-.4 0-.8.3-1 .3-.2.7-.2 1.1-.1-.1-.6-.2-1.3-.2-2 0-2.9 1.9-4.8 4.8-4.8" />
        </svg>
      );
    case 'website':
      return <Globe className={`${className} text-amber-400`} aria-hidden="true" />;
    default:
      return <Link2 className={`${className} text-cyan-400`} aria-hidden="true" />;
  }
};

interface SupplierContactLinksProps {
  socialLinks?: SupplierSocialLinks | null;
  showPrefixDot?: boolean;
  className?: string;
}

export const SupplierContactLinks: React.FC<SupplierContactLinksProps> = ({
  socialLinks,
  showPrefixDot = false,
  className = '',
}) => {
  const links = React.useMemo(() => buildContactLinksList(socialLinks), [socialLinks]);

  if (links.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
      data-testid="supplier-contact-links"
    >
      {showPrefixDot && <span className="text-slate-500 select-none">·</span>}
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 whitespace-nowrap shrink-0">
        <MessageCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>اتصل بالمتجر</span>
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            title={`${link.label}: ${link.href}`}
            aria-label={`اتصل بالمتجر عبر ${link.label}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-950/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <SocialPlatformIcon platform={link.key} className="w-3.5 h-3.5 shrink-0" />
            <span>{link.label}</span>
            <ExternalLink className="w-2.5 h-2.5 text-slate-500 shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
};
