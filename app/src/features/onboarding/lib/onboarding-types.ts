export type OnboardingStepId = "email-api" | "domain" | "account" | "complete";

export type OnboardingStepInfo = {
  id: OnboardingStepId;
  stepNumber: number;
  title: string;
  description: string;
};

export const ONBOARDING_STEPS: OnboardingStepInfo[] = [
  {
    id: "email-api",
    stepNumber: 1,
    title: "Email API",
    description: "Connect Cloudflare API token",
  },
  {
    id: "domain",
    stepNumber: 2,
    title: "Domain",
    description: "Connect & verify email domain",
  },
  {
    id: "account",
    stepNumber: 3,
    title: "Account",
    description: "Create mail accounts",
  },
  {
    id: "complete",
    stepNumber: 4,
    title: "Ready",
    description: "Launch your mailbox",
  },
];

export type OnboardingSummaryData = {
  cfAccountId?: string;
  workerUrl?: string;
  workerScriptName?: string;
  emailApiVerified: boolean;
  activeDomain?: string;
  createdAddress?: string;
  createdAddresses?: string[];
};
