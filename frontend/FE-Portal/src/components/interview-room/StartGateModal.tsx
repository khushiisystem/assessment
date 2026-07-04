import React, { memo } from 'react';
import { Loader2, Mic, ShieldCheck, Sparkles, Video } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export interface StartGateModalProps {
  open: boolean;
  /** Whether camera proctoring is enabled for this assessment. */
  enableCamera?: boolean;
  /** Whether voice recording is enabled for this assessment. */
  enableVoiceRecording?: boolean;
  policyConsent: boolean;
  isCheckingPermissions: boolean;
  /** Latest permission-check status line (shown under the CTA). */
  permissionStatus?: string;
  /** Eyebrow label above the title. Defaults to "Premium AI Interview". */
  eyebrow?: string;
  onPolicyChange: (checked: boolean) => void;
  onCheckPermissions: () => void;
}

/**
 * Premium "Ready to start?" gate shown before the candidate accepts proctoring
 * permissions. Pure presentational component — every behavioural decision
 * (camera state, fullscreen request, etc.) stays in the parent assessment page.
 */
const StartGateModalImpl: React.FC<StartGateModalProps> = ({
  open,
  enableCamera,
  enableVoiceRecording,
  policyConsent,
  isCheckingPermissions,
  permissionStatus,
  eyebrow = 'Premium AI Interview',
  onPolicyChange,
  onCheckPermissions,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-md">
      {/* Decorative aurora orbs behind the card */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-brand-violet/15 blur-3xl" />
        <div className="absolute -right-32 bottom-1/4 h-80 w-80 rounded-full bg-brand-purple/15 blur-3xl" />
      </div>

      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-[0_28px_72px_-16px_rgba(15,23,42,0.55),0_8px_24px_-12px_rgba(124,58,237,0.45)]">
        {/* Top accent strip */}
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple" />
        {/* Decorative ornaments inside card */}
        <span aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-violet/12 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-brand-purple/10 blur-3xl" />

        <div className="relative px-7 pt-7 pb-6">
          {/* Header */}
          <div className="mb-5 flex items-center gap-3">
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet text-white shadow-[0_8px_22px_-6px_rgba(124,58,237,0.55)] ring-1 ring-white/20">
              <img src="/SkilTechyFavicon.png" alt="" className="h-6 w-6" />
              <span aria-hidden className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/0 via-white/25 to-white/0" />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-violet">
                <Sparkles className="h-3 w-3" />
                {eyebrow}
              </p>
              <h2 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">Ready to start?</h2>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-slate-600">
            Fullscreen and camera permissions are required to begin. Your session is monitored end-to-end for proctoring.
          </p>

          {/* Rules */}
          <ul className="mt-4 space-y-2 text-sm">
            <RuleRow tone="emerald" text="Stay in fullscreen for the entire session" />
            {enableCamera !== false && (
              <RuleRow tone="violet" text="Keep your camera on for live proctoring" />
            )}
            {enableVoiceRecording && (
              <RuleRow tone="indigo" text="Voice answers are transcribed to text" />
            )}
            <RuleRow tone="amber" text="Tab switching or minimizing is recorded as an incident" />
          </ul>

          {/* Feature highlights */}
          {(enableCamera || enableVoiceRecording) && (
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {enableCamera && (
                <FeatureCard
                  icon={Video}
                  title="Camera monitoring"
                  description="Live feed used by the AI proctor."
                  tone="violet"
                />
              )}
              {enableVoiceRecording && (
                <FeatureCard
                  icon={Mic}
                  title="Voice answers"
                  description="Spoken answers are auto-transcribed."
                  tone="emerald"
                />
              )}
            </div>
          )}

          {/* Consent */}
          <label
            htmlFor="policy-consent"
            className={cn(
              'mt-5 flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all duration-200 hover:bg-slate-50/70',
              policyConsent
                ? 'border-brand-violet/30 bg-violet-50/40 ring-1 ring-inset ring-brand-violet/20'
                : 'border-slate-200/80 bg-white',
            )}
          >
            <Checkbox
              id="policy-consent"
              checked={policyConsent}
              onCheckedChange={(checked) => onPolicyChange(Boolean(checked))}
              className="mt-0.5 data-[state=checked]:border-brand-violet data-[state=checked]:bg-brand-violet"
            />
            <span className="text-sm leading-relaxed text-slate-700">
              I agree to stay in fullscreen and allow camera &amp; microphone access for proctoring.
            </span>
          </label>

          {/* CTA */}
          <button
            type="button"
            onClick={onCheckPermissions}
            disabled={!policyConsent || isCheckingPermissions}
            className="group mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_-6px_rgba(124,58,237,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-6px_rgba(124,58,237,0.65)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_10px_28px_-6px_rgba(124,58,237,0.30)]"
          >
            {isCheckingPermissions ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking permissions…
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                Check &amp; enable permissions
              </>
            )}
          </button>

          {permissionStatus && (
            <p className="mt-3 text-center text-xs font-medium text-slate-500">{permissionStatus}</p>
          )}
        </div>
      </div>
    </div>
  );
};

const RuleRow: React.FC<{
  tone: 'emerald' | 'violet' | 'indigo' | 'amber';
  text: string;
}> = ({ tone, text }) => {
  const toneCls =
    tone === 'emerald'
      ? 'bg-emerald-500'
      : tone === 'violet'
        ? 'bg-brand-violet'
        : tone === 'indigo'
          ? 'bg-indigo-500'
          : 'bg-amber-500';
  return (
    <li className="group/rule flex items-start gap-2.5 text-slate-700 transition-colors duration-200 hover:text-slate-900">
      <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ring-2 ring-inset', toneCls, 'ring-white')} />
      <span className="leading-relaxed">{text}</span>
    </li>
  );
};

const FeatureCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tone: 'violet' | 'emerald';
}> = ({ icon: Icon, title, description, tone }) => {
  const iconCls =
    tone === 'violet'
      ? 'bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-[0_4px_12px_-2px_rgba(124,58,237,0.45)] ring-1 ring-white/20'
      : 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_4px_12px_-2px_rgba(16,185,129,0.45)] ring-1 ring-white/20';
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50/70 p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-2.5">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconCls)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-tight text-slate-900">{title}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{description}</p>
        </div>
      </div>
    </div>
  );
};

export const StartGateModal = memo(StartGateModalImpl);
