import { GithubIcon } from "@/components/icons/github";

export function SignupPageHeader() {
  return (
    <div className="space-y-1 text-center">
      <h1 className="text-xl font-semibold tracking-tight">
        Create Account & Install Email worker
      </h1>
      <p className="text-sm text-muted-foreground">
        Connect Cloudflare, install the Email worker, then pick a username.
      </p>
      <p className="text-sm">
        <a
          href="https://github.com/strum-us/relaybase-worker"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 font-medium text-brand hover:underline"
        >
          <GithubIcon className="size-4 shrink-0" />
          relaybase-worker
        </a>
      </p>
    </div>
  );
}
