import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Generic Privacy Policy + Terms of Service templates.
 *
 * These are a starting point, not legal advice. Before relying on them, replace
 * every [bracketed] placeholder (operator name, contact email, jurisdiction)
 * and have them reviewed for your situation. The data-handling section is
 * written to match what AEN Scheduler actually does with Google user data,
 * which Google's OAuth verification expects the privacy policy to disclose.
 */

const SERVICE_NAME = 'AEN Scheduler';
const LAST_UPDATED = 'September 7, 2026';
const CONTACT_EMAIL = 'hello@aentan.com';
const OPERATOR = 'Aen Tan';
const JURISDICTION = 'Singapore';

function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <header className="pb-4 mb-8 border-b border-ink">
          <Link to="/" className="font-mono text-sm text-emphasis-2 hover:text-ink">
            ← Back
          </Link>
          <h1 className="font-mono font-bold text-2xl uppercase tracking-wide text-ink mt-3">
            {title}
          </h1>
          <p className="font-mono text-sm text-emphasis-2 mt-1">
            {SERVICE_NAME} &middot; Last updated: {LAST_UPDATED}
          </p>
        </header>

        <div className="space-y-8 leading-relaxed text-[15px] text-emphasis-1">{children}</div>

        <footer className="mt-14 pt-4 border-t border-ink font-mono text-sm text-emphasis-2 flex gap-6">
          <Link to="/privacy" className="hover:text-ink">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-ink">Terms of Service</Link>
        </footer>
      </div>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-mono font-bold text-sm uppercase tracking-widest text-ink">{heading}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5 text-emphasis-2">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p className="text-emphasis-2">
        This Privacy Policy explains how {OPERATOR} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects,
        uses, and protects your information when you use {SERVICE_NAME} (the &ldquo;Service&rdquo;),
        a scheduling tool that lets visitors book time that is added to a connected Google Calendar.
      </p>

      <Section heading="Information we collect">
        <p className="text-emphasis-2">
          <strong className="text-ink">Account &amp; Google sign-in.</strong> When an owner signs in
          with Google, we receive basic profile information from Google — your name, email address,
          profile picture, and Google account identifier — to create and identify your account.
        </p>
        <p className="text-emphasis-2">
          <strong className="text-ink">Google Calendar data.</strong> With your permission, we access
          your Google Calendar to (a) read free/busy information across the calendars you connect so
          we can compute your availability, and (b) create, update, and delete calendar events that
          correspond to bookings made through the Service. We store limited calendar metadata (such as
          calendar names and identifiers) needed to operate the Service.
        </p>
        <p className="text-emphasis-2">
          <strong className="text-ink">Authorization tokens.</strong> We store the OAuth access and
          refresh tokens Google issues so the Service can maintain your calendar connection without
          asking you to sign in repeatedly. These tokens are used only to make the calendar requests
          described above.
        </p>
        <p className="text-emphasis-2">
          <strong className="text-ink">Booking details.</strong> When someone books a meeting, we
          collect the information they provide — name, email address, optional phone number, time zone,
          and any message — along with the meeting time and type, in order to schedule the meeting and
          notify both parties.
        </p>
      </Section>

      <Section heading="How we use information">
        <List
          items={[
            'Provide the core service: compute availability, prevent double-bookings, and create calendar events.',
            'Send transactional email — booking confirmations, reminders, cancellations, and reschedules — and alert an owner when a calendar connection needs attention.',
            'Maintain the security and integrity of the Service and troubleshoot problems.',
          ]}
        />
      </Section>

      <Section heading="Google API Services — Limited Use">
        <p className="text-emphasis-2">
          {SERVICE_NAME}&rsquo;s use and transfer of information received from Google APIs adheres to the{' '}
          <a
            className="underline hover:text-ink"
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Specifically, we do not use Google user data for
          advertising, we do not sell it, and we do not transfer or use it for purposes other than
          providing the scheduling features you request — except as necessary for security operations
          or to comply with applicable law.
        </p>
      </Section>

      <Section heading="How information is shared">
        <p className="text-emphasis-2">We do not sell your personal information. We share it only:</p>
        <List
          items={[
            'With the other party to a booking, to the extent needed to schedule and hold the meeting (for example, an attendee’s name and email appear on the calendar event).',
            'With service providers that operate the Service on our behalf — for example, our cloud hosting provider and our transactional email provider — under obligations to protect the data.',
            'When required by law, or to protect the rights, safety, and security of our users and the Service.',
          ]}
        />
      </Section>

      <Section heading="Data retention and deletion">
        <p className="text-emphasis-2">
          We retain your data for as long as your account or booking records are active or as needed to
          provide the Service. You can revoke the Service&rsquo;s access to your Google account at any
          time from your{' '}
          <a
            className="underline hover:text-ink"
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Account permissions
          </a>{' '}
          page, or by disconnecting the account within the Service; doing so deletes the stored OAuth
          tokens for that account. To request deletion of your account and associated data, contact us
          at {CONTACT_EMAIL}.
        </p>
      </Section>

      <Section heading="Cookies and local storage">
        <p className="text-emphasis-2">
          After sign-in, we store an authentication token in your browser&rsquo;s local storage to keep
          you signed in. We do not use third-party advertising or tracking cookies.
        </p>
      </Section>

      <Section heading="Security">
        <p className="text-emphasis-2">
          We use reasonable technical and organizational measures to protect your information, including
          encrypted transport (HTTPS) and access controls. No method of transmission or storage is
          completely secure, and we cannot guarantee absolute security.
        </p>
      </Section>

      <Section heading="Children">
        <p className="text-emphasis-2">
          The Service is not directed to children and is not intended for use by anyone under the age
          required to form a binding contract in their jurisdiction.
        </p>
      </Section>

      <Section heading="Changes to this policy">
        <p className="text-emphasis-2">
          We may update this Privacy Policy from time to time. Material changes will be reflected by
          updating the &ldquo;Last updated&rdquo; date above.
        </p>
      </Section>

      <Section heading="Contact">
        <p className="text-emphasis-2">
          Questions about this policy or your data? Contact {OPERATOR} at {CONTACT_EMAIL}.
        </p>
      </Section>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p className="text-emphasis-2">
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of {SERVICE_NAME}{' '}
        (the &ldquo;Service&rdquo;), operated by {OPERATOR}. By using the Service, you agree to these
        Terms. If you do not agree, do not use the Service.
      </p>

      <Section heading="The service">
        <p className="text-emphasis-2">
          {SERVICE_NAME} lets an account owner publish booking pages so visitors can schedule meetings,
          which are added to the owner&rsquo;s connected Google Calendar with conflict checking and
          email notifications. We may add, change, or remove features at any time.
        </p>
      </Section>

      <Section heading="Accounts and your responsibilities">
        <List
          items={[
            'You are responsible for the activity that happens under your account and for keeping your credentials and connected accounts secure.',
            'You must provide accurate information and use the Service in compliance with all applicable laws and the terms of any connected third-party services (such as Google).',
            'You are responsible for the content you enter and for honoring the meetings you schedule or accept.',
          ]}
        />
      </Section>

      <Section heading="Acceptable use">
        <p className="text-emphasis-2">You agree not to:</p>
        <List
          items={[
            'Use the Service for unlawful, harmful, or abusive purposes, or to send spam or unsolicited communications.',
            'Attempt to gain unauthorized access to the Service, other accounts, or its underlying systems, or interfere with its normal operation.',
            'Reverse engineer, resell, or misuse the Service except as permitted by law.',
          ]}
        />
      </Section>

      <Section heading="Third-party services">
        <p className="text-emphasis-2">
          The Service integrates with third-party services, including Google Calendar. Your use of those
          services is governed by their own terms and policies, and we are not responsible for them. You
          are responsible for maintaining any third-party accounts you connect.
        </p>
      </Section>

      <Section heading="Availability and disclaimer">
        <p className="text-emphasis-2">
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties
          of any kind, whether express or implied, including fitness for a particular purpose and
          non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or that
          scheduling and calendar synchronization will always succeed.
        </p>
      </Section>

      <Section heading="Limitation of liability">
        <p className="text-emphasis-2">
          To the maximum extent permitted by law, {OPERATOR} will not be liable for any indirect,
          incidental, special, consequential, or punitive damages, or for any loss of data, meetings,
          profits, or goodwill, arising out of or related to your use of the Service.
        </p>
      </Section>

      <Section heading="Termination">
        <p className="text-emphasis-2">
          You may stop using the Service at any time and disconnect your accounts. We may suspend or
          terminate access if you violate these Terms or if we discontinue the Service.
        </p>
      </Section>

      <Section heading="Changes to these terms">
        <p className="text-emphasis-2">
          We may update these Terms from time to time. Continued use of the Service after changes take
          effect constitutes acceptance of the updated Terms.
        </p>
      </Section>

      <Section heading="Governing law">
        <p className="text-emphasis-2">
          These Terms are governed by the laws of {JURISDICTION}, without regard to its conflict-of-laws
          rules.
        </p>
      </Section>

      <Section heading="Contact">
        <p className="text-emphasis-2">
          Questions about these Terms? Contact {OPERATOR} at {CONTACT_EMAIL}.
        </p>
      </Section>
    </LegalShell>
  );
}
