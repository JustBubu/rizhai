"use client";

import { useState } from "react";
import { toast } from "sonner";
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
      toast.success(editing ? "仓库已更新" : "仓库已添加");
      onSaved(data.repo);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "没有保存成功");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑仓库" : "添加仓库"}</DialogTitle>
          <DialogDescription>
            地址指到你平时提交的那一层，多数项目是 trunk。账号只写在这台电脑上。
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="repo-name">名称</Label>
            <Input
              id="repo-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="订单中心"
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="repo-url">SVN 地址</Label>
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
              使用这台电脑已经保存的 SVN 凭据
              <span className="mt-0.5 block text-muted-foreground">
                你在终端里登录过这个仓库时选这个。日摘不会再存一份密码。
              </span>
            </span>
          </label>
          {useSavedAuth ? null : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="repo-user">用户名</Label>
                <Input
                  id="repo-user"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="repo-pass">密码</Label>
                <Input
                  id="repo-pass"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={editing?.hasPassword ? "已保存，留空则不改" : ""}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
