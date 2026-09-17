"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getHqUser,
  hqChangePassword,
  hqFetchMe,
  hqRequestPasswordReset,
  hqUpdateProfile,
  subscribeHqAuth,
} from "@/lib/hq-auth/session";

export function StudioAccountSettingsView() {
  const initialUser = getHqUser();
  const [email, setEmail] = useState(initialUser?.email ?? "");
  const [name, setName] = useState(initialUser?.name ?? "");
  const [savedName, setSavedName] = useState(initialUser?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [sendingReset, setSendingReset] = useState(false);
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);

  useEffect(() => {
    function syncFromSession() {
      const user = getHqUser();
      if (!user) return;
      setEmail(user.email);
      setName(user.name ?? "");
      setSavedName(user.name ?? "");
    }
    syncFromSession();
    const unsub = subscribeHqAuth(syncFromSession);
    void hqFetchMe().catch(() => {
      /* offline or session expired — gate handles redirect */
    });
    return unsub;
  }, []);

  const nameDirty = name !== savedName;
  const canSavePassword =
    Boolean(currentPassword && newPassword && confirmPassword) &&
    newPassword === confirmPassword;

  async function saveName() {
    if (!nameDirty) return;
    setSavingName(true);
    setNameError(null);
    try {
      const user = await hqUpdateProfile(name);
      setSavedName(user.name ?? "");
      setName(user.name ?? "");
      toast.success("Name updated");
    } catch (e) {
      setNameError(e instanceof Error ? e.message : "Could not save name");
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword() {
    if (!canSavePassword) return;
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    setSavingPassword(true);
    setPasswordError(null);
    try {
      await hqChangePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFormOpen(false);
      toast.success("Password updated");
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : "Could not update password");
    } finally {
      setSavingPassword(false);
    }
  }

  async function sendResetEmail() {
    if (!email.trim()) return;
    setSendingReset(true);
    try {
      await hqRequestPasswordReset(email.trim());
      toast.success("If an account exists, a reset link was sent.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send reset email");
    } finally {
      setSendingReset(false);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">Studio settings</h1>
          <p className="text-sm text-muted-foreground">
            Your Relaybase Studio cloud account.
          </p>
        </div>
      </DesktopTitleBar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[640px] space-y-6 p-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Display name for your Studio account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="studio-settings-email">Email</Label>
                <Input id="studio-settings-email" value={email} disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="studio-settings-name">Name</Label>
                <Input
                  id="studio-settings-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  disabled={savingName}
                />
              </div>
              {nameError ? (
                <p className="text-sm text-destructive">{nameError}</p>
              ) : null}
              <Button size="sm" onClick={() => void saveName()} disabled={savingName || !nameDirty}>
                {savingName ? "Saving…" : "Save name"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>
                Set a new sign-in password when you know your current one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!passwordFormOpen ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPasswordError(null);
                    setPasswordFormOpen(true);
                  }}
                >
                  Reset password
                </Button>
              ) : (
                <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="studio-current-password">Current password</Label>
                    <Input
                      id="studio-current-password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={savingPassword}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="studio-new-password">New password</Label>
                    <Input
                      id="studio-new-password"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={savingPassword}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="studio-confirm-password">Confirm new password</Label>
                    <Input
                      id="studio-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={savingPassword}
                    />
                  </div>
                  {passwordError ? (
                    <p className="text-sm text-destructive">{passwordError}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => void savePassword()}
                      disabled={savingPassword || !canSavePassword}
                    >
                      {savingPassword ? "Updating…" : "Update password"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={savingPassword}
                      onClick={() => {
                        setPasswordFormOpen(false);
                        setPasswordError(null);
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmPassword("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                  <div className="border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground">
                      Don&apos;t know your current password?{" "}
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs"
                        disabled={sendingReset || !email.trim()}
                        onClick={() => void sendResetEmail()}
                      >
                        {sendingReset ? "Sending…" : "Email a reset link"}
                      </Button>{" "}
                      or{" "}
                      <Link href="/forgot-password" className="underline underline-offset-2">
                        use forgot password
                      </Link>
                      .
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
