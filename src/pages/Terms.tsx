import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Terms = () => {
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
        <h1 className="text-lg font-semibold">Terms of Service</h1>
      </header>

      <article className="prose prose-sm max-w-none px-6 py-6 text-foreground">
        <p className="text-xs text-muted-foreground">Last updated: April 18, 2026</p>
        <p>
          By creating a PrivateChats account you agree to these terms. Please read them
          carefully.
        </p>

        <h2 className="mt-6 text-base font-semibold">Eligibility</h2>
        <p className="text-sm">
          You must be at least 13 years old (or the minimum age in your country) to use
          PrivateChats.
        </p>

        <h2 className="mt-6 text-base font-semibold">Your account</h2>
        <ul className="ml-5 list-disc space-y-1 text-sm">
          <li>You're responsible for keeping your password secure.</li>
          <li>One person, one account. Don't impersonate others.</li>
          <li>Usernames must follow our format: lowercase letters, numbers, underscores.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">Acceptable use</h2>
        <p className="text-sm">You agree not to:</p>
        <ul className="ml-5 list-disc space-y-1 text-sm">
          <li>Send illegal, harmful, or harassing content.</li>
          <li>Spam, scrape, or attempt to break the service.</li>
          <li>Distribute malware or infringe others' rights.</li>
        </ul>
        <p className="text-sm">
          We may suspend or terminate accounts that violate these rules.
        </p>

        <h2 className="mt-6 text-base font-semibold">Content ownership</h2>
        <p className="text-sm">
          You own the messages and media you send. By using PrivateChats you grant us a
          limited license to store and deliver them as needed to operate the service.
        </p>

        <h2 className="mt-6 text-base font-semibold">Service availability</h2>
        <p className="text-sm">
          PrivateChats is provided "as is". We work hard to keep it reliable but can't
          guarantee uninterrupted service.
        </p>

        <h2 className="mt-6 text-base font-semibold">Changes</h2>
        <p className="text-sm">
          We may update these terms. Material changes will be announced in-app.
        </p>

        <h2 className="mt-6 text-base font-semibold">Contact</h2>
        <p className="text-sm">
          Reach us at{" "}
          <a className="text-primary underline" href="mailto:support@privatechats.app">
            support@privatechats.app
          </a>
          .
        </p>
      </article>
    </div>
  );
};

export default Terms;
