import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Crown, Loader2, Lock, ShieldCheck } from "lucide-react";

import { useAcceptInviteInfoQuery, useAcceptInviteMutation } from "@/store/api/authApi";
import { tokenStorage } from "@/lib/tokenStorage";
import { cn } from "@/lib/utils";
import { CARD_SHADOW, BTN_PRIMARY, INPUT_CLASS, LABEL_SM_CLASS } from "@/lib/uiStyles";

import { getErrorMessage as errMessage } from "@/lib/errors";

const AcceptInvite = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const { data: info, isLoading, isError } = useAcceptInviteInfoQuery(token, { skip: !token });
  const [acceptInvite, { isLoading: submitting }] = useAcceptInviteMutation();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    try {
      const res = await acceptInvite({ token, password }).unwrap();
      tokenStorage.setAccessToken(res.access);
      if (res.refresh) tokenStorage.setRefreshToken(res.refresh);
      tokenStorage.setUser(res.user);
      navigate("/admin", { replace: true });
    } catch (e) {
      setError(errMessage(e));
    }
  };

  const invalid = !token || isError;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-violet-50/60 px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={cn("w-full max-w-md rounded-3xl border border-slate-200/70 bg-white p-7", CARD_SHADOW)}
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-md">
            <Crown className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Set up your admin account</h1>
            <p className="text-sm text-slate-500">Organization administrator</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Validating your invite…
          </div>
        ) : invalid ? (
          <div className="py-6 text-center">
            <p className="text-sm text-slate-600">This invite link is invalid or has expired.</p>
            <Link to="/login" className="mt-3 inline-block text-sm font-semibold text-brand-violet hover:underline">
              Go to login
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50/60 p-3 text-sm">
              <p className="font-semibold text-slate-800">{info?.organization || "Your organization"}</p>
              <p className="text-slate-500">{info?.email}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className={LABEL_SM_CLASS}>New password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    className={cn(INPUT_CLASS, "pl-9")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                  />
                </div>
              </div>
              <div>
                <label className={LABEL_SM_CLASS}>Confirm password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    className={cn(INPUT_CLASS, "pl-9")}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                  />
                </div>
              </div>

              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

              <button className={cn(BTN_PRIMARY, "w-full")} onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Set password &amp; continue
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default AcceptInvite;
