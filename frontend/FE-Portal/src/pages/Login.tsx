import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { ShieldCheck, Lock, Eye, EyeOff, Upload, Loader2, User, Building2, Sparkles, Mail, Phone, Globe, Check } from "lucide-react";
import { tokenStorage } from "@/lib/tokenStorage";
import { PROFILE_OPTIONS } from "@/constants/profileOptions";
import {
  useLoginMutation,
  useLazyGoogleLoginQuery,
  useRegisterMutation,
  useVerifyOtpMutation,
  useResendOtpMutation,
  useAppDispatch,
  setCredentials,
  useGetOrganizationsQuery,
} from "@/store";
import  logo  from '/logo-black.png';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const dispatch = useAppDispatch();
  const role = location.state?.role;
  const roleLabel = role === "super_admin" ? "Admin" : role === "org_admin" ? "Organization Admin" : role === "manager" ? "Manager" : role === "candidate" ? "Candidate" : "User";

  // RTK Query hooks
  const [login, { isLoading: isLoginLoading }] = useLoginMutation();
  const [triggerGoogleLogin] = useLazyGoogleLoginQuery();
  const [register] = useRegisterMutation();
  const [verifyOtp] = useVerifyOtpMutation();
  const [resendOtp] = useResendOtpMutation();

  // Redirect if already logged in's
  useEffect(() => {
    const token = tokenStorage.getAccessToken();
    const user = tokenStorage.getUser<{ role: string }>();
    if (token && user) {
      const params = new URLSearchParams(location.search);
      const redirectParam = params.get('redirect');

      if (redirectParam) {
        navigate(redirectParam, { state: { user } });
      } else if (user?.role === "super_admin" || user?.role === "org_admin" || user?.role === "manager") {
        navigate("/admin");
      } else if (user?.role === "candidate") {
        navigate("/candidate/dashboard");
      } else {
        navigate("/");
      }
    }
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Signup account type: 'employee' | 'individual' | 'organization'
  type SignupType = 'employee' | 'individual' | 'organization';
  const [signupType, setSignupType] = useState<SignupType>('employee');
  const [signupStep, setSignupStep] = useState(1);

  // For employee signup form (existing)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [resumeName, setResumeName] = useState("");
  const [profile, setProfile] = useState("");
  const [organization, setOrganization] = useState("");

  // For individual signup
  const [indTechStack, setIndTechStack] = useState<string[]>([]);

  // For organization signup
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("Company");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgPhone, setOrgPhone] = useState("");
  const [orgWebsite, setOrgWebsite] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");

  // Fetch organizations for employee signup dropdown
  const { data: organizations, isLoading: isLoadingOrganizations } = useGetOrganizationsQuery();


  const defaultTab = location.pathname === "/signup"
  ? "signup"
  : (location.state?.defaultTab || "login");

const [activeTab, setActiveTab] = useState(defaultTab);


  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // For OTP verification (employee signup)
  const [otpId, setOtpId] = useState<number | null>(null);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [signupError, setSignupError] = useState("");

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const TECH_OPTIONS = [
    'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#',
    'React', 'Vue', 'Angular', 'Node.js', 'Django', 'FastAPI',
    'Spring Boot', 'SQL', 'MongoDB', 'Docker', 'Kubernetes',
    'AWS', 'Azure', 'Machine Learning', 'Data Science', 'DevOps',
  ];

  const ORG_TYPES = ['Company', 'Institute', 'Other'];

  // Add this useEffect to handle potential OAuth errors on login page
  useEffect(() => {
    // Check if there's an OAuth error in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const oauthError = urlParams.get('error');

    if (oauthError) {
      toast({
        title: "Google Login Failed",
        description: "Authentication was cancelled or failed.",
        variant: "destructive",
        duration: 3000
      });

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      // Store the current location to redirect back after login
      const redirectUrl = location.state?.from?.pathname || location.state?.from || "/";
      sessionStorage.setItem("oauth_redirect_url", redirectUrl);

      const response = await triggerGoogleLogin().unwrap();
      const auth_url = response?.auth_url;

      // Redirect to Google OAuth
      window.location.href = auth_url;
    } catch (error: any) {
      console.error("Google Login Error:", error);
      toast({
        title: "Google Login Failed",
        description: "Unable to initiate Google login. Please try again.",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoginLoading) return;
    try {
      const response = await login({ email, password }).unwrap();
      const { access, refresh, user } = response;

      // Store credentials in Redux (also persists via tokenStorage inside setCredentials)
      dispatch(setCredentials({ user, accessToken: access, refreshToken: refresh }));

      // Keep backward-compatible tokenStorage calls
      if (access) {
        tokenStorage.setAccessToken(access);
      }
      if (refresh) {
        tokenStorage.setRefreshToken(refresh);
      }
      tokenStorage.setUser(user);

      // Show success toast
      toast({
        title: "Login Successful",
        description: `Welcome back, ${user?.name || user?.email}!`,
        variant: "success",
        duration: 3000
      });
      const params = new URLSearchParams(location.search);
      const redirectParam = params.get('redirect');

      // Check if there's a redirect location from a protected route
      const from = location.state?.from?.pathname;

      if (redirectParam) {
        navigate(redirectParam, { state: { user } });
      } else if (from && from !== "/login") {
        const canAccessAdmin =
          user?.role === "super_admin" || user?.role === "org_admin" || user?.role === "manager";
        if (from.startsWith("/admin") && !canAccessAdmin) {
          navigate("/candidate/dashboard", { state: { user } });
        } else {
          navigate(from, { state: { user } });
        }
      } else {
        // No redirect location, use role-based redirect
        if (user?.role === "super_admin" || user?.role === "org_admin" || user?.role === "manager") {
          navigate("/admin", { state: { user } });
        } else if (user?.role === "candidate") {
          navigate("/candidate/dashboard", { state: { user } });
        } else {
          navigate("/");
        }
      }

    } catch (error: any) {
      console.error("Login Error:", error);

      // Show error toast
      toast({
        title: "Login Failed",
        description: error.data?.message || "Invalid credentials. Please try again.",
        variant: "destructive",
        duration: 3000
      });

      if (error.data) {
        console.error("Login Error:", error.data);
      } else {
        console.error("Network Error:", error.message);
      }
    }
  };

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Check PDF extension
    const hasPdfExtension = file.name.toLowerCase().endsWith(".pdf");
    // Allow common PDF MIME types
    const validMimeTypes = [
        "application/pdf",
        "application/x-pdf",
        "application/octet-stream",
        ""
      ];
    const isValidMimeType = validMimeTypes.includes(file.type);
    if (!hasPdfExtension && !isValidMimeType) {
        toast({
          title: "Invalid File Type",
          description: "Please upload a valid PDF file.",
          variant: "destructive",
          duration: 3000,
        });
        e.target.value = "";
        setResume(null);
        setResumeName("");
        return;
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please upload a file smaller than 5MB.",
          variant: "destructive",
          duration: 3000,
        });
        e.target.value = "";
        setResume(null);
        setResumeName("");
        return;
      }

      setResume(file);
      setResumeName(file.name);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");

    if (signupType === 'employee') {
      // Existing employee signup logic
      if (signupPassword !== confirmPassword) {
        toast({ title: "Signup Failed", description: "Passwords do not match.", variant: "destructive", duration: 3000 });
        return;
      }
      if (!resume) {
        toast({ title: "Resume Required", description: "Please upload your resume.", variant: "destructive", duration: 3000 });
        return;
      }
      const cleanedPhone = phone.replace(/\D/g, '');
      if (!/^[0-9]{10}$/.test(cleanedPhone)) {
        toast({ title: "Invalid Phone", description: "Enter a valid 10-digit phone number.", variant: "destructive", duration: 3000 });
        return;
      }

      const formData = new FormData();
      formData.append("first_name", firstName);
      formData.append("last_name", lastName);
      formData.append("email", signupEmail);
      formData.append("phone", cleanedPhone);
      formData.append("profile", profile);
      formData.append("resume", resume);
      formData.append("organization_id", organization);
      setIsSigningUp(true);

      try {
        const response = await register(formData).unwrap();
        setOtpId(response.otp_id);
        setShowOtpVerification(true);
        setOtpCountdown(30);
        toast({ title: "OTP Sent", description: "OTP has been sent to your email. Please verify.", variant: "success", duration: 3000 });
      } catch (error: any) {
        const errorMessage = error.data?.phone?.[0] || error.data?.email?.[0] || error.data?.first_name?.[0] || error.data?.resume?.[0] || error.data?.message || "Registration failed.";
        toast({ title: "Registration Failed", description: errorMessage, variant: "destructive", duration: 3000 });
      } finally {
        setIsSigningUp(false);
      }
    } else if (signupType === 'individual') {
      // Individual signup - step 2 submit with tech stack
      if (indTechStack.length === 0) {
        setSignupError("Please select at least one skill.");
        return;
      }
      await submitIndividualSignup();
    } else if (signupType === 'organization') {
      // Organization signup - step 2 submit with admin details
      if (!adminFirstName.trim() || !adminLastName.trim() || !adminEmail.trim()) {
        setSignupError("Admin first name, last name, and email are required.");
        return;
      }
      if (adminPassword && adminPassword.length < 8) {
        setSignupError("Admin password must be at least 8 characters.");
        return;
      }
      if (adminPassword && adminPassword !== adminConfirmPassword) {
        setSignupError("Admin passwords do not match.");
        return;
      }
      await submitOrganizationSignup();
    }
  };

  const handleIndividualNext = () => {
    setSignupError("");
    if (!firstName.trim() || !lastName.trim()) {
      setSignupError("First name and last name are required.");
      return;
    }
    if (!signupEmail.trim() || !/\S+@\S+\.\S+/.test(signupEmail)) {
      setSignupError("Enter a valid email address.");
      return;
    }
    if (!signupPassword || signupPassword.length < 8) {
      setSignupError("Password must be at least 8 characters.");
      return;
    }
    if (signupPassword !== confirmPassword) {
      setSignupError("Passwords do not match.");
      return;
    }
    setSignupStep(2);
  };

  const handleOrgNext = () => {
    setSignupError("");
    if (!orgName.trim()) { setSignupError("Organization name is required."); return; }
    if (!orgEmail.trim() || !/\S+@\S+\.\S+/.test(orgEmail)) { setSignupError("Enter a valid organization email."); return; }
    setSignupStep(2);
  };

  const submitIndividualSignup = async () => {
    setIsSigningUp(true);
    setSignupError("");
    try {
      const res = await fetch('/v1/api/register/unified/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_type: 'individual',
          first_name: firstName,
          last_name: lastName,
          email: signupEmail,
          password: signupPassword,
          tech_stack: indTechStack,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const { access, refresh, user } = data;
        if (access && refresh && user) {
          dispatch(setCredentials({ user, accessToken: access, refreshToken: refresh }));
          tokenStorage.setAccessToken(access);
          tokenStorage.setRefreshToken(refresh);
          tokenStorage.setUser(user);
          toast({ title: "Account Created!", description: "Welcome! Redirecting to dashboard...", variant: "success", duration: 3000 });
          setTimeout(() => navigate("/candidate/dashboard"), 1500);
          return;
        }
        toast({ title: "Account Created!", description: "Login credentials sent to your email.", variant: "success", duration: 3000 });
        setActiveTab("login");
      } else {
        const errors = data.errors || {};
        const msg = errors.email || errors.password || errors.first_name || data.error || data.detail || "Registration failed.";
        setSignupError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
    } catch {
      setSignupError("Network error. Please check your connection.");
    } finally {
      setIsSigningUp(false);
    }
  };

  const submitOrganizationSignup = async () => {
    setIsSigningUp(true);
    setSignupError("");
    try {
      const res = await fetch('/v1/api/register/unified/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_type: 'organization',
          org_name: orgName,
          org_type: orgType,
          org_email: orgEmail,
          org_phone: orgPhone,
          org_website: orgWebsite,
          admin_first_name: adminFirstName,
          admin_last_name: adminLastName,
          admin_email: adminEmail,
          admin_password: adminPassword || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const { access, refresh, user } = data;
        if (access && refresh && user) {
          dispatch(setCredentials({ user, accessToken: access, refreshToken: refresh }));
          tokenStorage.setAccessToken(access);
          tokenStorage.setRefreshToken(refresh);
          tokenStorage.setUser(user);
          toast({ title: "Organization Created!", description: "Redirecting to admin dashboard...", variant: "success", duration: 3000 });
          setTimeout(() => navigate("/admin"), 1500);
          return;
        }
        toast({ title: "Organization Created!", description: `Credentials sent to ${adminEmail}.`, variant: "success", duration: 3000 });
        setActiveTab("login");
      } else {
        const errors = data.errors || {};
        const msg = errors.org_name || errors.org_email || errors.admin_email || errors.admin_first_name || data.error || data.detail || "Registration failed.";
        setSignupError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
    } catch {
      setSignupError("Network error. Please check your connection.");
    } finally {
      setIsSigningUp(false);
    }
  };

  const resetSignupForm = () => {
    setSignupStep(1);
    setSignupError("");
    setFirstName(""); setLastName(""); setSignupEmail(""); setSignupPassword(""); setConfirmPassword("");
    setPhone(""); setResume(null); setResumeName(""); setProfile(""); setOrganization("");
    setIndTechStack([]);
    setOrgName(""); setOrgType("Company"); setOrgEmail(""); setOrgPhone(""); setOrgWebsite("");
    setAdminFirstName(""); setAdminLastName(""); setAdminEmail(""); setAdminPassword(""); setAdminConfirmPassword("");
    setShowOtpVerification(false);
  };

  // OTP Input Handlers
  const handleOtpChange = (index: number, value: string) => {
    if (/^[0-9]?$/.test(value)) {
      const newOtp = [...otpCode];
      newOtp[index] = value;
      setOtpCode(newOtp);

      // Auto-focus next input
      if (value && index < 5) {
        otpInputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      // Move to previous input on backspace
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '');
    const digits = pastedData.slice(0, 6).split('');

    if (digits.length === 6) {
      const newOtp = [...otpCode];
      digits.forEach((digit, index) => {
        newOtp[index] = digit;
      });
      setOtpCode(newOtp);

      // Focus the last input
      otpInputRefs.current[5]?.focus();
    }
  };

  const handleOtpVerification = async (e: React.FormEvent) => {
    e.preventDefault();

    const fullOtp = otpCode.join('');
    if (!otpId || fullOtp.length !== 6) {
      toast({
        title: "Verification Failed",
        description: "Please enter the complete 6-digit OTP code.",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    setIsVerifyingOtp(true);

    try {
      const response = await verifyOtp({ otpId: String(otpId), otp_code : fullOtp }).unwrap();

      if (response.status) {
        // Show success toast
        toast({
          title: "Registration Successful",
          description: `Your account has been created. Login credentials have been sent to ${signupEmail}.`,
          variant: "success",
          duration: 3000,
        });

        // Reset form and switch to login tab
        setFirstName("");
        setLastName("");
        setSignupEmail("");
        setSignupPassword("");
        setConfirmPassword("");
        setPhone("");
        setResume(null);
        setResumeName("");
        setProfile("");
        setOtpCode(["", "", "", "", "", ""]);
        setShowOtpVerification(false);
        setActiveTab("login");
      } else {
        toast({
          title: "Verification Failed",
          description: response.message || "Invalid OTP code. Please try again.",
          variant: "destructive",
          duration: 3000
        });
      }
    } catch (error: any) {
      console.error("OTP Verification Error:", error);

      const errorMessage = error.data?.message ||
        error.data?.otp_code?.[0] ||
        "OTP verification failed. Please try again.";

      toast({
        title: "Verification Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!otpId || isResendingOtp || otpCountdown > 0) return;

    setIsResendingOtp(true);

    try {
      await resendOtp(String(otpId)).unwrap();

      setOtpCountdown(30); // Reset countdown
      setOtpCode(["", "", "", "", "", ""]); // Clear OTP inputs

      toast({
        title: "OTP Resent",
        description: "A new OTP has been sent to your email.",
        variant: "success",
        duration: 3000
      });

      // Focus first OTP input
      otpInputRefs.current[0]?.focus();

    } catch (error: any) {
      console.error("Resend OTP Error:", error);

      const errorMessage = error.data?.message ||
        "Failed to resend OTP. Please try again.";

      toast({
        title: "Resend Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsResendingOtp(false);
    }
  };

  const clearResume = () => {
    setResume(null);
    setResumeName("");
    // Clear the file input
    const fileInput = document.getElementById('resume-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="h-screen bg-[#F4F6FF] login-screen">
      <div className="mx-auto w-full max-w-auto h-screen">
        <div className="w-full grid grid-cols-1 md:grid-cols-2  xl:grid-cols-[0.50fr_0.50fr]">

          <div className="bg-white p-8 shadow-[0_35px_60px_rgba(15,23,42,0.08)] overflow-y-scroll h-[100vh]">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="SkilTechy" className="h-5 w-auto" />
              {/* <span className="text-lg font-semibold tracking-tight text-slate-900">Skiltechy</span> */}
            </div>
            <div className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 gap-2">
              You are signing in as <span className="text-[#FF6518]">{roleLabel}</span>
            </div>
          </div>

          <div className="mt-10 max-w-auto space-y-4 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-[#08010D]">Join Skiltechy!</h1>
            <p className="text-sm leading-6 text-[#4A464C]">
              Choose an option below to enhance<br /> your learning experience with the<br /> Skiltechy platform.
            </p>
          </div>

          <div className="mt-8">
            <div className=" p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                {role === 'super_admin' ? (
                  <TabsList className="flex justify-center w-full gap-3 mb-6">
                    <TabsTrigger value="login" className="text-base px-5 py-2">
                      Admin Login
                    </TabsTrigger>
                  </TabsList>
                ) : (
                  <TabsList className="grid w-full grid-cols-2 gap-3 mb-6">
                    <TabsTrigger value="login" className="text-base px-5 py-2">Login</TabsTrigger>
                    {role === 'candidate' && (
                      <TabsTrigger value="signup" className="text-base px-5 py-2">Sign Up</TabsTrigger>
                    )}
                  </TabsList>
                )}

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700">Email *</label>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="space-y-1 relative">
                      <label className="text-xs font-medium text-slate-700">Password *</label>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-10 text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-9 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="remember"
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                          className="h-4 w-4"
                        />
                        <label htmlFor="remember" className="text-xs text-slate-500 cursor-pointer">
                          Remember me
                        </label>
                      </div>
                      <Button type="button" variant="link" className="text-primary p-0 text-xs">
                        <Link to="/reset-password" state={{ email: email }}>Forgot Password?</Link>
                      </Button>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 bg-[#08010D] text-sm"
                      disabled={isLoginLoading}
                    >
                      {isLoginLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Logging in...
                        </span>
                      ) : (
                        "Login"
                      )}
                    </Button>

                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-slate-200" />
                      </div>
                      <div className="relative flex justify-center text-[14px] uppercase tracking-[0.18em] text-slate-400">
                        <span className="bg-slate-50 px-2">OR</span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isGoogleLoading}
                      variant="outline"
                      className="w-full h-11 border border-slate-300 text-slate-700 hover:text-white relative overflow-hidden transition-all duration-300 before:absolute before:inset-0 before:bg-gradient-to-r before:from-gray-600 before:to-gray-800 before:scale-x-0 hover:before:scale-x-100 before:origin-left before:transition-transform before:duration-300 before:z-0"
                    >
                      {isGoogleLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mx-auto"></div>
                      ) : (
                        <span className="relative z-10 flex items-center justify-center text-sm gap-2">
                          <svg className="h-4 w-4" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                          Sign sign with Google
                        </span>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                {role === 'candidate' && (
                  <TabsContent value="signup">
                    {!showOtpVerification ? (
                      <form onSubmit={handleSignup} className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">First Name *</label>
                            <Input
                              type="text"
                              placeholder="Enter your first name"
                              required
                              className="h-10 text-sm"
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">Last Name *</label>
                            <Input
                              type="text"
                              placeholder="Enter your last name"
                              required
                              className="h-10 text-sm"
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-700">Email *</label>
                          <Input
                            type="email"
                            placeholder="Enter your email"
                            required
                            className="h-10 text-sm"
                            value={signupEmail}
                            onChange={(e) => setSignupEmail(e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-700">Phone Number *</label>
                          <Input
                            type="tel"
                            placeholder="Enter your 10-digit phone number"
                            required
                            className="h-10 text-sm"
                            value={phone}
                            onChange={(e) => {
                              const numbers = e.target.value.replace(/\D/g, '').slice(0, 10);
                              setPhone(numbers);
                            }}
                            pattern="[0-9]{10}"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-700">Profile *</label>
                          <select
                            value={profile}
                            onChange={(e) => setProfile(e.target.value)}
                            required
                            className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1"
                          >
                            <option value="">Select your profile</option>
                            {PROFILE_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-700">Resume (PDF only) *</label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              accept=".pdf,application/pdf"
                              onChange={handleResumeChange}
                              className="hidden"
                              id="resume-upload"
                            />
                            <label
                              htmlFor="resume-upload"
                              className="flex items-center gap-1 px-3 py-2 text-xs border border-dashed border-slate-300 rounded-md cursor-pointer hover:bg-slate-50 transition-colors flex-1"
                            >
                              <Upload size={14} />
                              <span className="truncate">{resumeName || "Choose PDF file"}</span>
                            </label>
                            {resumeName && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={clearResume}
                                className="shrink-0 h-9 text-xs"
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            Upload your resume in PDF format (max 5MB)
                          </p>
                        </div>

                        <Button
                          type="submit"
                          className="w-full h-11 bg-[#08010D] text-sm"
                          disabled={isSigningUp}
                        >
                          {isSigningUp ? "Registering..." : "Sign Up"}
                        </Button>
                      </form>
                    ) : (
                      <form onSubmit={handleOtpVerification} className="space-y-4">
                        <div className="text-center mb-4">
                          <h3 className="text-base font-semibold text-slate-900">Verify Your Email</h3>
                          <p className="text-xs text-slate-500 mt-1">
                            We've sent a 6-digit OTP to {signupEmail}
                          </p>
                        </div>

                        <div className="space-y-3">
                          <label className="text-xs font-medium text-slate-700 text-center block">
                            Enter OTP Code *
                          </label>
                          <div className="flex justify-center gap-2">
                            {otpCode.map((digit, index) => (
                              <Input
                                key={index}
                                ref={(el) => (otpInputRefs.current[index] = el)}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleOtpChange(index, e.target.value)}
                                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                onPaste={index === 0 ? handleOtpPaste : undefined}
                                className="w-10 h-10 text-center text-base font-semibold"
                                autoFocus={index === 0}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="text-center">
                          <Button
                            type="button"
                            variant="link"
                            onClick={handleResendOtp}
                            disabled={isResendingOtp || otpCountdown > 0}
                            className="text-primary text-xs"
                          >
                            {isResendingOtp ? "Sending..." :
                              otpCountdown > 0 ? `Resend OTP in ${otpCountdown}s` :
                                "Resend OTP"}
                          </Button>
                        </div>

                        <div className="flex gap-2 pt-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowOtpVerification(false)}
                            className="flex-1 h-10 text-sm"
                            disabled={isVerifyingOtp}
                          >
                            Back
                          </Button>
                          <Button
                            type="submit"
                            className="flex-1 h-10 bg-gradient-primary text-sm"
                            disabled={isVerifyingOtp || otpCode.join('').length !== 6}
                          >
                            {isVerifyingOtp ? "Verifying..." : "Verify OTP"}
                          </Button>
                        </div>
                      </form>
                    )}
                  </TabsContent>
                )}
              </Tabs>
              <p className="mt-6 text-xs text-slate-400">
                By clicking Continue, you agree to Skiltechy privacy notice, Terms and to receive offers, news and updates.
              </p>
            </div>
          </div>
        </div>

        <div
  className="relative flex h-screen flex-col justify-between overflow-hidden bg-cover bg-center bg-no-repeat p-8 text-white"
  style={{
    backgroundColor: "#3D065F",
    backgroundImage: "url('/login-line.png')",
    backgroundBlendMode: "overlay",
  }}
>
  <div className="text-center xl:pt-[30px] 2xl:pt-[120px]">
    <img className="m-auto" src="/top-baner.png" />
  </div>

  <div className="relative z-10 mt-auto">
    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
      <div className="rounded-3xl bg-white/10 p-4">
        <img src="/code-icon.png" alt="code" />
        <p className="text-2xl font-semibold text-white">40+</p>
        <p className="mt-2 text-white/75">Technologies</p>
      </div>

      <div className="rounded-3xl bg-white/10 p-4">
      <img src="/keyboard.png" alt="keyboard" />
        <p className="text-2xl font-semibold text-white">75+</p>
        <p className="mt-2 text-white/75">Different Courses</p>
      </div>

      <div className="rounded-3xl bg-white/10 p-4">
      <img src="/rating.png" alt="rating" className="pt-3 pb-4" />
        <p className="text-2xl font-semibold text-white">1200+</p>
        <p className="mt-2 text-white/75">5 Star Ratings</p>
      </div>
    </div>
  </div>
</div>
      </div>
    </div>
  </div>
  );
};

export default Login;
