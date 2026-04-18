import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Privacy = () => {
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-2xl pb-24">
      <header className="glass sticky top-0 z-20 flex items-center gap-3 rounded-b-3xl px-3 py-3">
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Privacy Policy</h1>
      </header>

      <article className="prose prose-sm max-w-none px-6 py-6 text-foreground">
        <p className="text-xs text-muted-foreground">Last updated: April 18, 2026</p>
        <p>
          PrivateChats ("we", "us") respects your privacy. This page explains what we
          collect, why, and your choices.
        </p>

        <h2 className="mt-6 text-base font-semibold">Information we collect</h2>
        <ul className="ml-5 list-disc space-y-1 text-sm">
          <li>Account info: email, username, display name, avatar, bio.</li>
          <li>Messages: text, images, and voice notes you send and receive.</li>
          <li>Activity metadata: last-seen timestamp (you can hide this in Settings).</li>
          <li>Device info: browser/OS for security and debugging only.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">How we use it</h2>
        <ul className="ml-5 list-disc space-y-1 text-sm">
          <li>To deliver your messages and show your profile to people you chat with.</li>
          <li>To keep your account secure and prevent abuse.</li>
          <li>To remember your settings (theme, accent color, privacy toggles).</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">What we don't do</h2>
        <ul className="ml-5 list-disc space-y-1 text-sm">
          <li>We don't sell your data.</li>
          <li>We don't show ads.</li>
          <li>We don't read your messages, except as required by law or to investigate abuse.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">Storage & security</h2>
        <p className="text-sm">
          Messages and media are stored securely with row-level access controls. Voice notes
          and chat images are kept in a private bucket and only accessible to the sender and
          recipient. Avatars are publicly readable so they can render in chats.
        </p>

        <h2 className="mt-6 text-base font-semibold">Your choices</h2>
        <ul className="ml-5 list-disc space-y-1 text-sm">
          <li>Hide your last-seen status in Settings → Privacy.</li>
          <li>Block users to prevent contact (Settings → Blocked users).</li>
          <li>Delete your account by contacting support.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">Contact</h2>
        <p className="text-sm">
          Questions? Reach out to{" "}
          <a className="text-primary underline" href="mailto:privacy@privatechats.app">
            privacy@privatechats.app
          </a>
          .
        </p>
      </article>
    </div>
  );
};

export default Privacy;
