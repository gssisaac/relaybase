"use client";

import { LogOut, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmailAlerts } from "@/email/components/EmailShared";
import { useMailAccounts } from "@/email/components/MailAccountsContext";
import { ACCOUNT_COLOR_PALETTE } from "@/email/account-colors";
import { useEmailPaths } from "@/email/paths";
import { clearEmailCache } from "@/email/components/email-cached-fetch";
import { useDesktop } from "@/lib/desktop/DesktopContext";
import {
  desktopClearCredentials,
  desktopClearRelaybaseAccount,
  desktopClearTeamLogin,
} from "@/lib/desktop/bridge";
import { notifyAddressesChanged } from "@/lib/dashboard/accounts-sync";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import {
  desktopAwareFetch,
  readResponseJson,
} from "@/lib/desktop/api-base";
import { cn } from "@/lib/utils";

function domainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

type TeamProfile = {
  displayName: string;
  signature: string;
};

export function EmailSettingsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const { teamLogin, refresh: refreshDesktop } = useDesktop();
  const isTeam = Boolean(teamLogin);
  const {
    availableAddresses,
    enabledAddresses,
    accountColors,
    getSignature,
    setSignature,
    setAccountColor,
    removeEnabledAccount,
    refreshAddresses,
  } = useMailAccounts();

  // Account list for the inner sidebar. Team mode is locked to the single
  // authenticated account; admin mode shows every enabled address.
  const accounts = useMemo(
    () =>
      isTeam
        ? teamLogin
          ? [
              {
                email: teamLogin.accountEmail,
                domain: teamLogin.accountEmail.split("@")[1] ?? "",
              },
            ]
          : []
        : enabledAddresses,
    [enabledAddresses, isTeam, teamLogin],
  );

  const accountFromUrl =
    searchParams.get("account")?.trim() ||
    searchParams.get("from")?.trim() ||
    null;

  const [selectedEmail, setSelectedEmail] = useState<string>(
    () =>
      accountFromUrl && accountFromUrl !== "all"
        ? accountFromUrl
        : (accounts[0]?.email ?? ""),
  );

  // Derive the effective selection during render so a stale selection (e.g.
  // after the account was disabled) falls back to the first account without
  // an extra effect.
  const selectionValid = accounts.some(
    (a) => a.email.toLowerCase() === selectedEmail.toLowerCase(),
  );
  const activeEmail = selectionValid
    ? selectedEmail
    : (accounts[0]?.email ?? "");

  const selectedAddress = availableAddresses.find(
    (a) => a.email.toLowerCase() === activeEmail.toLowerCase(),
  );

  const [displayName, setDisplayName] = useState("");
  const [savedDisplayName, setSavedDisplayName] = useState("");
  const [signature, setSignatureText] = useState("");
  const [color, setColor] = useState<string>("");
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Load profile for the selected account.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!activeEmail) return;
      if (isTeam && teamLogin) {
        try {
          const res = await fetch(
            `${teamLogin.workerUrl.replace(/\/$/, "")}/mobile/profile`,
            {
              headers: {
                "X-Account-Email": activeEmail,
                Authorization: `Bearer ${teamLogin.mobilePassword}`,
              },
            },
          );
          const data = (await res.json().catch(() => ({}))) as
            | (TeamProfile & { ok?: boolean; error?: string })
            | null;
          if (!cancelled) {
            const name = data?.displayName ?? "";
            setDisplayName(name);
            setSavedDisplayName(name);
            setSignatureText(getSignature(activeEmail));
            setColor(accountColors[activeEmail.toLowerCase()] ?? "");
          }
        } catch {
          if (!cancelled) {
            setDisplayName("");
            setSavedDisplayName("");
            setSignatureText(getSignature(activeEmail));
            setColor(accountColors[activeEmail.toLowerCase()] ?? "");
          }
        }
        return;
      }
      const name = selectedAddress?.displayName ?? "";
      setDisplayName(name);
      setSavedDisplayName(name);
      setSignatureText(getSignature(activeEmail));
      setColor(accountColors[activeEmail.toLowerCase()] ?? "");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    activeEmail,
    selectedAddress?.displayName,
    accountColors,
    getSignature,
    isTeam,
    teamLogin,
  ]);

  const identityDirty = displayName !== savedDisplayName;
  const signatureDirty = signature !== getSignature(activeEmail);
  const colorDirty =
    (color ?? "") !== (accountColors[activeEmail.toLowerCase()] ?? "");

  async function saveIdentity() {
    if (!activeEmail || !identityDirty) return;
    setSavingIdentity(true);
    setError(null);
    try {
      if (isTeam && teamLogin) {
        const res = await fetch(
          `${teamLogin.workerUrl.replace(/\/$/, "")}/mobile/profile`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "X-Account-Email": activeEmail,
              Authorization: `Bearer ${teamLogin.mobilePassword}`,
            },
            body: JSON.stringify({ displayName }),
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "Failed to save");
        }
      } else {
        const res = await desktopAwareFetch(`${apiBase}/addresses`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: activeEmail, displayName }),
        });
        const data = await readResponseJson<{ error?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to save");
        const domainKey = domainOf(activeEmail);
        clearEmailCache(productId, `addresses:${domainKey}`);
        clearEmailCache(productId, "addresses:all");
        notifyAddressesChanged({
          domain: domainKey,
          emails: [activeEmail],
        });
        await refreshAddresses();
      }
      setSavedDisplayName(displayName);
      toast.success("Display name saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingIdentity(false);
    }
  }

  async function saveColor() {
    if (!activeEmail || !colorDirty) return;
    setAccountColor(activeEmail, color);
    toast.success("Account color saved");
  }

  async function saveSignature() {
    if (!activeEmail || !signatureDirty) return;
    setSavingSignature(true);
    setError(null);
    try {
      // Phase 1: local pref only. Phase 2 will also PATCH /addresses or
      // /mobile/profile with the signature field.
      setSignature(activeEmail, signature);
      toast.success("Signature saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingSignature(false);
    }
  }

  function handleDisableAccount() {
    if (!activeEmail) return;
    removeEnabledAccount(activeEmail);
    setDisableOpen(false);
    router.push("/email/inbox");
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      if (isTeam) {
        await desktopClearTeamLogin();
        await refreshDesktop();
        router.replace("/login");
      } else {
        await desktopClearCredentials();
        await desktopClearRelaybaseAccount();
        await refreshDesktop();
        router.replace("/setup/account");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign out failed");
    } finally {
      setSigningOut(false);
    }
  }

  if (!accounts.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DesktopTitleBar className="px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              Email settings
            </h1>
          </div>
        </DesktopTitleBar>
        <div className="mx-auto w-full max-w-[640px] p-4">
          <p className="text-sm text-muted-foreground">
            No accounts yet. Add one from the sidebar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            Email settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Per-account display name and signature.
          </p>
        </div>
      </DesktopTitleBar>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Inner account sidebar */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <nav
            className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2"
            aria-label="Accounts"
          >
            {accounts.map((account) => {
              const active =
                account.email.toLowerCase() === activeEmail.toLowerCase();
              return (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => setSelectedEmail(account.email)}
                  title={account.email}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        accountColors[account.email.toLowerCase()] ??
                        ACCOUNT_COLOR_PALETTE[0],
                    }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {account.email}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Sign out — global, at the bottom of the account sidebar */}
          <div className="shrink-0 border-t border-sidebar-border p-2">
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
                    disabled={signingOut}
                  />
                }
              >
                <LogOut className="size-3.5" />
                Sign out of Relaybase
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign out of Relaybase?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {isTeam
                      ? "Clears your team login from this device and returns you to the sign-in page."
                      : "Clears your admin credentials from this device and returns you to setup."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={signingOut}
                    onClick={() => void handleSignOut()}
                  >
                    {signingOut ? "Signing out…" : "Sign out"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </aside>

        {/* Right pane: selected account settings */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[640px] space-y-6 p-4">
              <EmailAlerts error={error} message={null} />

              <Card>
                <CardHeader>
                  <CardTitle>Identity</CardTitle>
                  <CardDescription>
                    How your name and account appear to recipients for{" "}
                    <span className="font-medium text-foreground">
                      {activeEmail}
                    </span>
                    .
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-email">Email</Label>
                    <Input id="settings-email" value={activeEmail} disabled />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-display-name">Display name</Label>
                    <Input
                      id="settings-display-name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Optional"
                      disabled={savingIdentity}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Account color</Label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="No color"
                        onClick={() => setColor("")}
                        className={cn(
                          "size-6 rounded-full border bg-transparent",
                          color === ""
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : "border-border",
                        )}
                      />
                      {ACCOUNT_COLOR_PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Color ${c}`}
                          onClick={() => setColor(c)}
                          className={cn(
                            "size-6 rounded-full border",
                            color === c
                              ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                              : "border-transparent",
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Used for the account dot in the sidebar.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void saveIdentity()}
                      disabled={savingIdentity || !identityDirty}
                    >
                      {savingIdentity ? "Saving…" : "Save name"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void saveColor()}
                      disabled={!colorDirty}
                    >
                      Save color
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Signature</CardTitle>
                  <CardDescription>
                    Plain-text signature appended to new drafts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={signature}
                    onChange={(e) => setSignatureText(e.target.value)}
                    placeholder="Optional signature"
                    rows={5}
                    disabled={savingSignature}
                  />
                  <Button
                    size="sm"
                    onClick={() => void saveSignature()}
                    disabled={savingSignature || !signatureDirty}
                  >
                    {savingSignature ? "Saving…" : "Save signature"}
                  </Button>
                </CardContent>
              </Card>

              {/* Per-account danger zone (admin only — team has a single
                  account, so disabling it == signing out). */}
              {!isTeam ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Remove from email</CardTitle>
                    <CardDescription>
                      Hide this account from the mail sidebar. Mail and
                      credentials stay intact — re-add it from Add account to
                      restore the view.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => setDisableOpen(true)}
                    >
                      <Trash2 className="size-3.5" />
                      Disable this account in email
                    </Button>
                    <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>
                            Disable {activeEmail} in email?
                          </DialogTitle>
                          <DialogDescription>
                            Removes it from the mail sidebar. You can re-add it
                            from Add account later.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setDisableOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleDisableAccount}
                          >
                            Disable account
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
