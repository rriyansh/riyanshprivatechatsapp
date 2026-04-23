import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const sections = [
  {
    title: "Eligibility",
    body: [
      "You must be at least 13 years old, or the minimum age required in your country, to use PrivateChats. If you use the service on behalf of an organization, you confirm that you have authority to accept these terms for that organization.",
      "You may not use PrivateChats if you are legally prohibited from receiving or using messaging services under applicable law.",
    ],
  },
  {
    title: "User responsibilities",
    items: [
      "Keep your login credentials secure and do not share access to your account.",
      "Use accurate account information and do not impersonate another person, brand, or organization.",
      "Respect other users' privacy, consent, safety, and legal rights.",
      "Report abuse, security issues, or harmful behavior when you become aware of it.",
      "Use profile photos, usernames, display names, and bios responsibly.",
    ],
  },
  {
    title: "Acceptable use",
    body: [
      "PrivateChats is intended for lawful personal communication and community interaction. You agree not to misuse the service or interfere with other users' experience.",
    ],
    items: [
      "Do not send threats, harassment, hate, exploitation, illegal content, or non-consensual intimate content.",
      "Do not spam, scrape, automate abusive actions, or attempt to overload the service.",
      "Do not upload malware, phishing links, deceptive content, or content that infringes intellectual property rights.",
      "Do not attempt to bypass privacy controls, access restrictions, rate limits, or security protections.",
      "Do not use the app to coordinate fraud, violence, illegal transactions, or harmful activity.",
    ],
  },
  {
    title: "Account rules",
    items: [
      "Each account should represent one real user or authorized identity.",
      "Usernames must use the supported format and may be changed or reclaimed if they violate rules or cause confusion.",
      "You are responsible for all activity that occurs under your account.",
      "Private account, blocked users, app lock, and visibility controls are provided for safety, but you should still communicate carefully.",
      "We may require account verification, email confirmation, or additional checks to protect the platform.",
    ],
  },
  {
    title: "Content ownership and license",
    body: [
      "You own the content you create and send through PrivateChats, including messages, profile information, images, and voice notes, subject to the rights of others and applicable law.",
      "You grant PrivateChats a limited, non-exclusive license to store, process, transmit, display, and deliver your content only as needed to operate, protect, and improve the service.",
    ],
  },
  {
    title: "Rooms and group communication",
    body: [
      "Room creators and administrators may manage room details and membership. Messages sent in rooms may be visible to room members. You should only share content in rooms when you are comfortable with authorized members seeing it.",
    ],
  },
  {
    title: "Safety, moderation, and enforcement",
    body: [
      "We may investigate suspected violations, restrict features, remove content, disable accounts, or preserve information when needed for safety, legal compliance, or service integrity.",
      "Enforcement decisions may consider context, severity, repeated behavior, risk to users, and legal obligations.",
    ],
  },
  {
    title: "Termination policy",
    items: [
      "You may stop using PrivateChats at any time.",
      "We may suspend or terminate access if you violate these terms, create risk, cause harm, or misuse the service.",
      "After termination, some information may remain in backups, legal records, security logs, or conversations visible to other authorized users.",
      "Certain provisions, including content licenses needed for operation, disclaimers, and liability limits, may survive termination.",
    ],
  },
  {
    title: "Service availability",
    body: [
      "PrivateChats is provided on an as-available basis. We work to keep the app reliable, but we do not guarantee uninterrupted access, error-free operation, or permanent availability of any feature.",
    ],
  },
  {
    title: "Disclaimers and limitation of liability",
    body: [
      "To the maximum extent allowed by law, PrivateChats is provided without warranties of any kind. We are not responsible for user-generated content, third-party conduct, device issues, network outages, or losses that are not directly caused by our unlawful conduct.",
    ],
  },
  {
    title: "Changes to these terms",
    body: [
      "We may update these Terms of Service as the app changes. Material updates may be announced in-app or through another reasonable method. Continued use of PrivateChats after updates means you accept the revised terms.",
    ],
  },
];

const Terms = () => {
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-3xl pb-24">
      <header className="glass sticky top-0 z-20 flex items-center gap-3 rounded-b-3xl px-3 py-3">
        <Button size="icon" variant="ghost" className="rounded-full" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Terms of Service</h1>
          <p className="text-xs text-muted-foreground">Last updated: April 23, 2026</p>
        </div>
      </header>

      <article className="px-5 py-6">
        <div className="mb-6 rounded-[2rem] glass-strong p-6">
          <p className="text-sm leading-7 text-muted-foreground">
            These terms govern your access to and use of PrivateChats. Please read them carefully before creating an account or using messaging, rooms, profile, or privacy features.
          </p>
        </div>

        <div className="space-y-4">
          {sections.map((section) => (
            <section key={section.title} className="rounded-[2rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <h2 className="text-base font-semibold">{section.title}</h2>
              {section.body?.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-sm leading-7 text-muted-foreground">{paragraph}</p>
              ))}
              {section.items && (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </section>
          ))}

          <section className="rounded-[2rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-base font-semibold">Contact</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              For questions about these terms, contact <a className="text-primary underline" href="mailto:support@privatechats.app">support@privatechats.app</a>.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
};

export default Terms;
