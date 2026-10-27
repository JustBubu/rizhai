"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { ApiError, api } from "@/lib/client";
import type { RepoPublic } from "@/lib/types";
import { Button } from "@/components/ui/button";
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

type Mode = { kind: "create" } | { kind: "edit"; repo: RepoPublic };

export function RepoDialog({
  mode,
  onOpenChange,
  onSaved,
}: {
  mode: Mode;
  onOpenChange: (open: boolean) => void;
  onSaved: (repo: RepoPublic) => void;
}) {
  const { t } = useLocale();
  const editing = mode.kind === "edit" ? mode.repo : null;
  const [name, setName] = useState(editing?.name ?? "");
  const [url, setUrl] = useState(editing?.url ?? "");
  const [username, setUsername] = useState(editing?.username ?? "");
  const [password, setPassword] = useState("");
  const [useSavedAuth, setUseSavedAuth] = useState(editing?.useSavedAuth ?? false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        url,
        username,
        useSavedAuth,
        enabled: editing?.enabled ?? true,
      };
      if (password) payload.password = password;
      const path = editing ? `/api/repos/${editing.id}` : "/api/repos";
      const data = await api<{ repo: RepoPublic }>(path, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      toast.success(editing ? t("repoUpdated") : t("repoAdded"));
      onSaved(data.repo);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("toastRepoSaveFail"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t("repoEdit") : t("repoAdd")}</DialogTitle>
          <DialogDescription>{t("repoDialogDesc")}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="repo-name">{t("repoName")}</Label>
            <Input
              id="repo-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("repoNamePlaceholder")}
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="repo-url">{t("repoUrl")}</Label>
            <Input
              id="repo-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://svn.company.com/repos/order/trunk"
              spellCheck={false}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={useSavedAuth}
              onChange={(event) => setUseSavedAuth(event.target.checked)}
            />
            <span>
              {t("useSavedAuth")}
              <span className="mt-0.5 block text-muted-foreground">{t("useSavedAuthHint")}</span>
            </span>
          </label>
          {useSavedAuth ? null : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="repo-user">{t("username")}</Label>
                <Input
                  id="repo-user"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="repo-pass">{t("password")}</Label>
                <Input
                  id="repo-pass"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={editing?.hasPassword ? t("passwordKept") : ""}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
