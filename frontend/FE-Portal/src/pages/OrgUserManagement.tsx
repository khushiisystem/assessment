import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, ArrowLeft, Loader2, Check, AlertCircle, UserPlus } from 'lucide-react';
import { tokenStorage } from '@/lib/tokenStorage';

const ALL_ROLE_OPTIONS = [
  { value: 'candidate', label: 'Candidate', description: 'Takes assessments and courses' },
  { value: 'manager', label: 'Manager', description: 'Creates assessments and invites candidates' },
] as const;

interface FormData {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  phone: string;
  profile: string;
}

const OrgUserManagement: React.FC = () => {
  const navigate = useNavigate();
  // A manager can only invite candidates; org_admin / super_admin can also
  // invite managers.
  const currentRole = tokenStorage.getUser<{ role?: string }>()?.role;
  const roleOptions =
    currentRole === 'manager'
      ? ALL_ROLE_OPTIONS.filter((o) => o.value === 'candidate')
      : ALL_ROLE_OPTIONS;
  const [form, setForm] = useState<FormData>({
    first_name: '',
    last_name: '',
    email: '',
    role: 'candidate',
    phone: '',
    profile: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [serverError, setServerError] = useState('');

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = 'First name is required.';
    if (!form.last_name.trim()) e.last_name = 'Last name is required.';
    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email.';
    if (!form.role) e.role = 'Please select a role.';
    if (form.phone && !/^\+?[\d\s\-()]{7,15}$/.test(form.phone)) e.phone = 'Enter a valid phone number.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setServerError('');
    setSuccess('');

    try {
      const token = tokenStorage.getAccessToken();
      // Use the configured API base (staging/prod) instead of a relative path,
      // which would otherwise resolve against the app's own origin (localhost).
      const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '/v1/').replace(/\/$/, '');
      const res = await fetch(`${apiBase}/api/org/users/create/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(`User "${form.first_name} ${form.last_name}" created successfully! Credentials sent to ${form.email}.`);
        setForm({ first_name: '', last_name: '', email: '', role: 'candidate', phone: '', profile: '' });
      } else if (data.errors) {
        setErrors(data.errors);
      } else {
        setServerError(data.error || data.detail || 'Failed to create user.');
      }
    } catch {
      setServerError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New User</h1>
            <p className="text-sm text-gray-500">Add a user to your organization with a specific role.</p>
          </div>
        </div>

        {/* Messages */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}
        {serverError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{serverError}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
          {/* Role Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <UserPlus className="w-4 h-4 inline mr-1 text-blue-500" />
              Select Role
            </label>
            <div className="grid grid-cols-2 gap-3">
              {roleOptions.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setForm(prev => ({ ...prev, role: opt.value }))}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    form.role === opt.value
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <p className={`text-sm font-semibold ${form.role === opt.value ? 'text-blue-700' : 'text-gray-700'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                </button>
              ))}
            </div>
            {errors.role && <p className="mt-1 text-xs text-red-500">{errors.role}</p>}
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="w-4 h-4 text-gray-400" />
                </div>
                <input id="first_name" value={form.first_name} onChange={set('first_name')}
                  placeholder="John" className={`w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                    errors.first_name ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400'
                  }`} />
              </div>
              {errors.first_name && <p className="mt-1 text-xs text-red-500">{errors.first_name}</p>}
            </div>
            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="w-4 h-4 text-gray-400" />
                </div>
                <input id="last_name" value={form.last_name} onChange={set('last_name')}
                  placeholder="Doe" className={`w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                    errors.last_name ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400'
                  }`} />
              </div>
              {errors.last_name && <p className="mt-1 text-xs text-red-500">{errors.last_name}</p>}
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="w-4 h-4 text-gray-400" />
              </div>
              <input id="email" type="email" value={form.email} onChange={set('email')}
                placeholder="user@company.com" className={`w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                  errors.email ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400'
                }`} />
            </div>
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>

          {/* Phone (optional) */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className="w-4 h-4 text-gray-400" />
              </div>
              <input id="phone" value={form.phone} onChange={set('phone')}
                placeholder="+91-9876543210" className={`w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                  errors.phone ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400'
                }`} />
            </div>
            {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
          </div>

          {/* Profile / Notes (optional) */}
          <div>
            <label htmlFor="profile" className="block text-sm font-medium text-gray-700 mb-1">Profile / Notes (optional)</label>
            <textarea id="profile" value={form.profile} onChange={set('profile')}
              rows={3} placeholder="Brief bio, department, or any notes..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-none" />
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating User...</>
              : <><UserPlus className="w-4 h-4" /> Create User</>}
          </button>

          <p className="text-center text-xs text-gray-400">
            A temporary password will be auto-generated and sent to the user's email.
          </p>
        </form>
      </div>
    </div>
  );
};

export default OrgUserManagement;
