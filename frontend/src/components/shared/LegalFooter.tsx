import React from 'react';
import { Link } from 'react-router-dom';

/** Privacy / Terms links for public-facing pages. Routes exist on both the
 *  canonical host and custom domains (see App.tsx). */
export function LegalFooter({ className = '' }: { className?: string }) {
  return (
    <div
      className={`font-mono text-sm text-emphasis-3 flex items-center justify-center gap-3 ${className}`}
    >
      <Link to="/privacy" className="hover:text-ink transition-colors">
        Privacy
      </Link>
      <span className="text-emphasis-4">&middot;</span>
      <Link to="/terms" className="hover:text-ink transition-colors">
        Terms
      </Link>
    </div>
  );
}
