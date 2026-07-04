import React, { useState, useEffect, useCallback } from 'react';
import { Check, Zap, Star, Shield, ArrowRight, Loader2, AlertCircle, CreditCard } from 'lucide-react';
import { tokenStorage } from '@/lib/tokenStorage';
import { useLocation } from 'react-router-dom';
import AdminLayout from '@/components/AdminLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { SurfaceCard } from '@/components/common/SurfaceCard';
import { cn } from '@/lib/utils';


interface Plan {
  id: number;
  name: string;
  plan_type: string;
  price: string;
  duration_months: number;
  assessments_per_month: number;
  ai_interviews_per_month: number;
  free_assessments_per_week: number;
  free_ai_assessments_per_week: number;
}

interface Subscription {
  id: number;
  plan_name: string;
  plan_type: string;
  price: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  is_valid: boolean;
}

interface Usage {
  assessments_used: number;
  ai_interviews_used: number;
  assessments_limit: number;
  ai_interviews_limit: number;
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free: <Zap className="w-6 h-6 text-brand-violet" />,
  monthly: <Star className="w-6 h-6 text-amber-500" />,
  yearly: <Shield className="w-6 h-6 text-brand-violet" />,
};

/**
 * Catalog fallback — used only when the backend's plans list comes back empty
 * (e.g. on a fresh staging env that hasn't seeded plans yet). The live API
 * response always wins when it has at least one plan. IDs are negative so they
 * never collide with real backend IDs; "Upgrade" on these is disabled until the
 * backend serves them, since the upgrade endpoint resolves the plan by ID.
 */
const FALLBACK_PLANS: Plan[] = [
  {
    id: -1,
    name: 'Free',
    plan_type: 'free',
    price: '0',
    duration_months: 0,
    assessments_per_month: 0,
    ai_interviews_per_month: 0,
    free_assessments_per_week: 2,
    free_ai_assessments_per_week: 2,
  },
  {
    id: -2,
    name: 'Pro Monthly',
    plan_type: 'monthly',
    price: '999',
    duration_months: 1,
    assessments_per_month: 100,
    ai_interviews_per_month: 100,
    free_assessments_per_week: 0,
    free_ai_assessments_per_week: 0,
  },
  {
    id: -3,
    name: 'Pro Yearly',
    plan_type: 'yearly',
    price: '9999',
    duration_months: 12,
    assessments_per_month: 100,
    ai_interviews_per_month: 100,
    free_assessments_per_week: 0,
    free_ai_assessments_per_week: 0,
  },
];

const SubscriptionPlans: React.FC = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [usingFallback, setUsingFallback] = useState(true);
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const token = tokenStorage.getAccessToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [plansRes, subRes] = await Promise.all([
        fetch('/v1/api/subscription/plans/'),
        token ? fetch('/v1/api/subscription/me/', { headers }) : Promise.resolve(null),
      ]);

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        if (Array.isArray(plansData) && plansData.length > 0) {
          setPlans(plansData);
          setUsingFallback(false);
        }
      }

      if (subRes && subRes.ok) {
        const subData = await subRes.json();
        setCurrentSub(subData.subscription);
        setUsage(subData.usage);
      }
    } catch {
      setError('Failed to load subscription data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpgrade = async (planId: number) => {
    setUpgrading(planId);
    setError('');
    setSuccessMsg('');
    try {
      const token = tokenStorage.getAccessToken();
      // Step 1: Create Razorpay order
      const orderRes = await fetch('/v1/api/subscription/create-order/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_id: planId }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        setError(orderData.error || 'Failed to create payment order.');
        setUpgrading(null);
        return;
      }

      // Step 2: Open Razorpay checkout
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Assessment Platform',
        description: `Subscription - ${orderData.plan_name}`,
        order_id: orderData.order_id,
        prefill: {
          email: orderData.user_email,
          name: orderData.user_name,
        },
        theme: { color: '#2563EB' },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          // Step 3: Verify payment on backend
          try {
            const verifyRes = await fetch('/v1/api/subscription/verify-payment/', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan_id: planId,
              }),
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok) {
              setSuccessMsg(verifyData.message || 'Payment successful! Subscription activated.');
              fetchData();
            } else {
              setError(verifyData.error || 'Payment verification failed.');
            }
          } catch {
            setError('Payment verification failed. Contact support if amount was deducted.');
          }
          setUpgrading(null);
        },
        modal: {
          ondismiss: () => {
            setUpgrading(null);
            setError('Payment cancelled.');
          },
        },
      };

      // Load Razorpay script if not already loaded
      if (!(window as any).Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        };
        script.onerror = () => {
          setError('Failed to load payment gateway. Please try again.');
          setUpgrading(null);
        };
        document.body.appendChild(script);
      } else {
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }
    } catch {
      setError('Network error. Please try again.');
      setUpgrading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will be downgraded to Free Tier.')) return;
    setError('');
    setSuccessMsg('');
    try {
      const token = tokenStorage.getAccessToken();
      const res = await fetch('/v1/api/subscription/cancel/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || 'Subscription cancelled.');
        fetchData();
      } else {
        setError(data.error || 'Cancel failed.');
      }
    } catch {
      setError('Network error.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-violet" />
      </div>
    );
  }

  const getFeatures = (plan: Plan): string[] => {
    if (plan.plan_type === 'free') {
      return [
        `${plan.free_assessments_per_week} Regular assessment per week`,
        `${plan.free_ai_assessments_per_week} AI interview per week`,
        'Limited course access (based on your profile)',
        'Email notifications',
        'Basic performance reports',
      ];
    }
    return [
      `${plan.assessments_per_month} assessments per month`,
      `${plan.ai_interviews_per_month} AI interviews per month`,
      'Full access to all courses',
      'Detailed AI feedback & analytics',
      'Priority support',
      plan.duration_months >= 12 ? 'Best value — save vs. monthly' : 'Cancel anytime',
    ];
  };

  const isCurrentPlan = (plan: Plan) =>
    currentSub && currentSub.plan_type === plan.plan_type && currentSub.is_active;

  const usagePct = (used: number, limit: number) =>
    limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;

  const planTypeLabel = (t: string) =>
    t === 'free' ? 'Free' : t === 'monthly' ? 'Monthly' : t === 'yearly' ? 'Yearly' : t;

  const pageContent = (
    <div className="w-full">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <PageHeader
          icon={CreditCard}
          title="Subscription"
          description="Manage your plan, usage, and billing."
        />

        {/* Current Plan & Usage */}
        {currentSub && (
          <SurfaceCard className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
                  {PLAN_ICONS[currentSub.plan_type] || <Star className="h-5 w-5" />}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold tracking-tight text-slate-900">{currentSub.plan_name}</h2>
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-violet ring-1 ring-inset ring-violet-100">
                      {planTypeLabel(currentSub.plan_type)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {currentSub.end_date
                      ? `Valid until ${new Date(currentSub.end_date).toLocaleDateString()}`
                      : 'No expiration (Free Tier)'}
                  </p>
                </div>
              </div>
              {currentSub.plan_type !== 'free' && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50"
                >
                  Cancel Plan
                </button>
              )}
            </div>

            {usage && (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { label: 'Assessments', used: usage.assessments_used, limit: usage.assessments_limit },
                  { label: 'AI Interviews', used: usage.ai_interviews_used, limit: usage.ai_interviews_limit },
                ].map((row) => {
                  const pct = usagePct(row.used, row.limit);
                  const isFull = pct >= 100;
                  return (
                    <div key={row.label} className="rounded-2xl border border-slate-200/70 bg-white p-3.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <span>{row.label}</span>
                        <span className={cn('tabular-nums', isFull ? 'text-rose-600' : 'text-slate-600')}>
                          {row.used} / {row.limit}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            isFull
                              ? 'bg-gradient-to-r from-rose-500 to-rose-600'
                              : 'bg-gradient-to-r from-brand-purple to-brand-violet'
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-500">{pct}% used</p>
                    </div>
                  );
                })}
              </div>
            )}
          </SurfaceCard>
        )}

        {/* Messages */}
        {error && (
          <SurfaceCard className="flex items-center gap-2 border-rose-200 bg-rose-50/70 p-3 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </SurfaceCard>
        )}
        {successMsg && (
          <SurfaceCard className="flex items-center gap-2 border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-700">
            <Check className="h-4 w-4 shrink-0" /> {successMsg}
          </SurfaceCard>
        )}

        {/* Plans */}
        <SurfaceCard className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-900">Available plans</h2>
              <p className="text-xs text-slate-500">
                {usingFallback
                  ? 'Preview catalog — live plans are being configured'
                  : 'Pick the plan that fits your workflow.'}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {plans.length} plan{plans.length !== 1 ? 's' : ''}
            </span>
          </div>

          {plans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-10 text-center">
              <CreditCard className="mx-auto mb-2 h-10 w-10 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No plans available</p>
              <p className="mt-1 text-xs text-slate-500">Plans are managed by the platform — check back later.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent = isCurrentPlan(plan);
                const isFree = plan.plan_type === 'free';
                const features = getFeatures(plan);
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      'group relative flex flex-col rounded-2xl border bg-white p-5 transition-all',
                      isCurrent
                        ? 'border-brand-violet ring-2 ring-brand-violet/30 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-18px_rgba(61,7,95,0.35)]'
                        : 'border-slate-200/70 hover:border-brand-violet/40 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-18px_rgba(61,7,95,0.35)]'
                    )}
                  >
                    {isCurrent && (
                      <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-purple to-brand-violet px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                        Current
                      </span>
                    )}

                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                          isCurrent ? 'bg-gradient-to-br from-brand-purple to-brand-violet text-white' : 'bg-violet-50 text-brand-violet'
                        )}
                      >
                        {PLAN_ICONS[plan.plan_type] || <Zap className="h-5 w-5" />}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold tracking-tight text-slate-900">{plan.name}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                          {planTypeLabel(plan.plan_type)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-baseline gap-1.5">
                      <span className="text-3xl font-extrabold tracking-tight text-slate-900">₹{plan.price}</span>
                      {!isFree && (
                        <span className="text-sm font-medium text-slate-500">
                          / {plan.duration_months === 1 ? 'month' : `${plan.duration_months} months`}
                        </span>
                      )}
                    </div>

                    <ul className="mt-4 flex-1 space-y-2">
                      {features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => !isCurrent && !isFree && plan.id > 0 && handleUpgrade(plan.id)}
                      disabled={isCurrent || isFree || plan.id < 0 || upgrading === plan.id}
                      className={cn(
                        'mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
                        isCurrent || isFree || plan.id < 0
                          ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-brand-purple to-brand-violet text-white shadow-sm hover:brightness-110 hover:shadow-md disabled:opacity-60'
                      )}
                    >
                      {upgrading === plan.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                        </>
                      ) : isCurrent ? (
                        'Current plan'
                      ) : isFree ? (
                        'Free tier'
                      ) : plan.id < 0 ? (
                        'Coming soon'
                      ) : (
                        <>
                          Upgrade <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </SurfaceCard>

        <p className="pt-2 text-center text-xs text-slate-500">
          Questions about plans? Contact support.
        </p>
      </div>
    </div>
  );

  if (isAdminRoute) {
    return <AdminLayout>{pageContent}</AdminLayout>;
  }
  return pageContent;
};

export default SubscriptionPlans;
