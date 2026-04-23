import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const sections = [
  {
    title: "Overview",
    body: [
      "PrivateChats is designed for private messaging, profile discovery, rooms, voice notes, media sharing, and account customization. This Privacy Policy explains the information we collect, how we use it, how we protect it, and the choices available to you.",
      "By using PrivateChats, you understand that your account, profile, messages, media, and app preferences may be processed so the service can function reliably and securely.",
    ],
  },
  {
    title: "Information we collect",
    items: [
      "Account information such as email address, username, nickname, profile photo, bio, and authentication status.",
      "Profile preferences including theme, chat accent, privacy controls, app lock preferences, and onboarding state.",
      "Communication content including one-to-one messages, room messages, images, voice notes, replies, reactions, and delivery state.",
      "Relationship and safety data such as follows, blocked users, group memberships, and room administration state.",
      "Activity metadata such as message timestamps, last-seen status, online visibility settings, and basic device/browser details used for security and debugging.",
    ],
  },
  {
    title: "How we use information",
    items: [
      "To create and maintain your account, profile, and username.",
      "To deliver messages, images, voice notes, reactions, and room conversations to the correct participants.",
      "To apply your privacy settings, including hidden last-seen, private account mode, read receipts, typing indicators, and blocked users.",
      "To keep the app secure, prevent abuse, rate-limit risky actions, and investigate reports or technical issues.",
      "To remember appearance settings such as theme, accent colors, and local chat customizations on your device.",
    ],
  },
  {
    title: "Messages, media, and rooms",
    body: [
      "Messages and media are stored only as needed to provide the chat experience. Access controls are designed so only the sender, intended recipient, or authorized room members can access relevant conversation data.",
      "Room content may be visible to current room members. Room administrators may manage room details and membership according to app rules.",
    ],
  },
  {
    title: "Privacy controls",
    items: [
      "You can hide your last-seen status from Settings.",
      "You can switch between public and private account mode where supported by the app experience.",
      "You can turn read receipts and typing indicators on or off.",
      "You can block users to prevent unwanted contact.",
      "You can configure app lock with a PIN on your device.",
      "You can choose who may see your online status where technically supported.",
    ],
  },
  {
    title: "Storage and security",
    body: [
      "We use technical safeguards, access rules, and secure storage practices to protect account data, messages, and media. No internet service can guarantee perfect security, but PrivateChats is built with privacy-by-default controls and restricted data access.",
      "Public profile photos may be publicly readable so they can appear in chats and profile views. Chat media is treated as private conversation content.",
    ],
  },
  {
    title: "Data sharing",
    items: [
      "We do not sell your personal information.",
      "We do not use your private messages for advertising.",
      "We may disclose information if required by law, to protect users, to prevent abuse, or to maintain service security.",
      "Limited technical service providers may process data only as needed to operate the app infrastructure.",
    ],
  },
  {
    title: "Data retention",
    body: [
      "We retain account data while your account is active or as needed to provide the service. Some records may be retained for security, abuse prevention, legal compliance, backups, or dispute resolution.",
      "Deleted or edited content may not disappear instantly from backups or logs, but it will be handled according to operational retention practices.",
    ],
  },
  {
    title: "Your choices and rights",
    items: [
      "You may update your username, nickname, bio, photo, and preferences from Settings.",
      "You may request account deletion or assistance by contacting support.",
      "You may manage privacy settings at any time, including blocked users and app lock.",
      "Depending on your region, you may have rights to access, correct, export, or delete personal information.",
    ],
  },
  {
    title: "Children and eligibility",
    body: [
      "PrivateChats is not intended for children under 13, or under the minimum digital consent age in your country. If we learn that an ineligible user has created an account, we may remove it.",
    ],
  },
  {
    title: "Changes to this policy",
    body: [
      "We may update this Privacy Policy as the app evolves. Material changes may be announced in-app or by another reasonable method. Continued use after changes means you accept the updated policy.",
    ],
  },
];

const Privacy = () => {
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-3xl pb-24">
      <header className="glass sticky top-0 z-20 flex items-center gap-3 rounded-b-3xl px-3 py-3">
        <Button size="icon" variant="ghost" className="rounded-full" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground">Last updated: April 23, 2026</p>
        </div>
      </header>

      <article className="px-5 py-6">
        <div className="mb-6 rounded-[2rem] glass-strong p-6">
          <p className="text-sm leading-7 text-muted-foreground">
            This policy is written to be clear and practical. It describes how PrivateChats handles data for messaging, profiles, rooms, media, safety controls, and personalization.
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
              Questions or privacy requests can be sent to <a className="text-primary underline" href="mailto:privacy@privatechats.app">privacy@privatechats.app</a>.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
};

export default Privacy;
