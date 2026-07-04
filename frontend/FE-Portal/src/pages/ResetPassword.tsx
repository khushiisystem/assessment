import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Mail, Lock, CheckCircle, Eye, EyeOff } from "lucide-react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import {
  useForgotPasswordMutation,
  useVerifyResetOtpMutation,
  useResetPasswordMutation,
} from "@/store";
import  logo  from '../zeclogo.png';

const ResetPassword = () => {
  const [step, setStep] = useState(1);
  const [contact, setContact] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordStrength, setPasswordStrength] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [otpId, setOtpId] = useState<number | null>(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  const emailFromLocation = location.state?.email || "";
  const inputRefs = useRef([]);
  const { toast } = useToast();

  // RTK Query hooks
  const [forgotPassword] = useForgotPasswordMutation();
  const [verifyResetOtp] = useVerifyResetOtpMutation();
  const [resetPassword] = useResetPasswordMutation();

  useEffect(() => {
    if (emailFromLocation) {
      setContact(emailFromLocation);
    }
  }, [emailFromLocation]);

  useEffect(() => {
    // Focus first input when step changes to 2
    if (step === 2 && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  useEffect(() => {
    // Check password strength when newPassword changes
    if (newPassword) {
      checkPasswordStrength(newPassword);
    } else {
      setPasswordStrength("");
    }
  }, [newPassword]);

  useEffect(() => {
    let timer;
    if (resendTimer > 0) {
      timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    } else if (resendTimer === 0 && !canResend) {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [resendTimer, canResend]);

  const startResendTimer = () => {
    setResendTimer(60);
    setCanResend(false);
  };

  const checkPasswordStrength = (password) => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= 8;

    const strengthPoints = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar, isLongEnough].filter(Boolean).length;

    if (strengthPoints <= 2) {
      setPasswordStrength("weak");
    } else if (strengthPoints <= 4) {
      setPasswordStrength("medium");
    } else {
      setPasswordStrength("strong");
    }
  };

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case "weak": return "text-red-500";
      case "medium": return "text-yellow-500";
      case "strong": return "text-green-500";
      default: return "text-gray-500";
    }
  };

  const getPasswordStrengthText = () => {
    switch (passwordStrength) {
      case "weak": return "Weak password";
      case "medium": return "Medium strength";
      case "strong": return "Strong password";
      default: return "";
    }
  };

  const handleStepClick = (stepNumber) => {
    if (stepNumber === 1) {
      setStep(1);
      setError("");
    } else if (stepNumber === 2 && contact) {
      setStep(2);
      setError("");
    } else if (stepNumber === 3 && contact && otp.join("").length === 6) {
      setStep(3);
      setError("");
    }
  };

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact)) {
      setError("Please enter a valid email address");
      setLoading(false);
      return;
    }

    try {
      const response = await forgotPassword({ contact: contact }).unwrap();

      setOtpId(response.otp_id);
      toast({
        title: "OTP Sent Successfully",
        description: `An OTP has been sent to ${contact}`,
        variant: "success",
        duration: 3000,
      });
      setStep(2);
      startResendTimer(); // Start the timer when OTP is sent
    } catch (error: any) {
      console.error("Error sending OTP:", error);

      // Specific error handling
      if (error.data?.error === "No user found with this email") {
        toast({
          title: "User Not Found",
          description: "No account is registered with this email address.",
          variant: "destructive",
          duration: 3000,
        });
      } else {
        toast({
          title: "Failed to Send OTP",
          description: error.data?.message || error.data?.error || "Something went wrong. Please try again.",
          variant: "destructive",
          duration: 3000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const pastedNumbers = pastedData.replace(/\D/g, ""); // Remove non-digits

    if (pastedNumbers.length === 6) {
      const newOtp = pastedNumbers.split("").slice(0, 6);
      setOtp(newOtp);

      // Focus the last input
      if (inputRefs.current[5]) {
        inputRefs.current[5].focus();
      }
    }
  };

  const handleVerifyOTP = async () => {
    setLoading(true);
    setError("");

    const enteredOtp = otp.join("");

    if (!enteredOtp || enteredOtp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      setLoading(false);
      return;
    }

    if (!otpId) {
      setError("OTP session expired. Please request a new OTP.");
      setLoading(false);
      return;
    }

    try {
      await verifyResetOtp({ otpId: String(otpId), otp_code: enteredOtp }).unwrap();

      toast({
        title: "OTP Verified",
        description: "Your OTP has been successfully verified.",
        variant: "success",
        duration: 3000,
      });

      // Move to next step
      setStep(3);
    } catch (error: any) {
      console.error("Error verifying OTP:", error);

      if (error.data?.error === "Invalid OTP" || error.data?.message === "Invalid OTP") {
        toast({
          title: "Invalid OTP",
          description: "The OTP you entered is incorrect. Please try again.",
          variant: "destructive",
          duration: 3000,
        });
      } else if (error.data?.error === "OTP expired") {
        toast({
          title: "OTP Expired",
          description: "Your OTP has expired. Please request a new one.",
          variant: "destructive",
          duration: 3000,
        });
      } else {
        toast({
          title: "Verification Failed",
          description: error.data?.error || error.data?.message || "Something went wrong. Please try again.",
          variant: "destructive",
          duration: 3000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");

    // Basic Validations
    if (!contact) {
      toast({
        title: "Missing Email",
        description: "Please provide your registered email address.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    if (newPassword.length > 20) {
      toast({
        title: "Too Long",
        description: "Password must not exceed 20 characters.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,20}$/;
    if (!passwordRegex.test(newPassword)) {
      toast({
        title: "Invalid Format",
        description:
          "Include uppercase, lowercase, number, and special character.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    if (!otpId) {
      toast({
        title: "Session Expired",
        description: "Please restart the password reset process.",
        variant: "success",
        duration: 3000,
      });
      return;
    }

    setLoading(true);

    try {
      const response = await resetPassword({
        otpId: String(otpId),
        new_password : newPassword,
        confirm_password: confirmPassword,
      }).unwrap();

      toast({
        title: "Success",
        description: response.message || "Password reset successful!",
        variant: "success",
        duration: 3000,
      });

      // Navigate to login with email prefilled
      setTimeout(() => navigate("/login", { state: { email: contact } }), 1500);
    } catch (error: any) {
      console.error("Reset password error:", error);

      if (error.message === "Network Error") {
        toast({
          title: "Network Error",
          description: "Unable to connect to the server. Please try again later.",
          variant: "destructive",
          duration: 3000,
        });
      } else {
        const errorMsg =
          error.data?.error ||
          error.data?.detail ||
          "Something went wrong. Please try again.";

        toast({
          title: "Password Reset Failed",
          description: errorMsg,
          variant: "destructive",
          duration: 3000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = (e) => {
    if (canResend) {
      handleSendOTP(e);
    }
  };

  const isOtpComplete = otp.every(digit => digit !== "");

  return (
    <div className="min-h-screen w-full bg-gradient-primary flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 bg-card rounded-2xl shadow-elegant overflow-hidden">
        <div className="bg-gradient-to-br from-primary via-primary-light to-primary-glow p-12 flex flex-col justify-center text-white">
          <div className="mb-8">
            <img
              src={ logo }
              alt="SkilTechy"
              className="h-12 mb-6 brightness-0 invert"
            />
            <h1 className="text-4xl font-bold mb-4">Reset Password</h1>
            <p className="text-lg text-white/90">
              Don't worry! We'll help you recover your account securely. Follow the steps to reset your password.
            </p>
          </div>

          <div className="space-y-4">
            <div
              className={`flex items-center gap-3 transition-all cursor-pointer p-3 rounded-lg ${step >= 1 ? 'opacity-100 bg-white/10' : 'opacity-50 hover:opacity-70'
                }`}
              onClick={() => handleStepClick(1)}
            >
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-white/20' : 'bg-white/10'
                }`}>
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Step 1: Enter Email</div>
                <div className="text-sm text-white/80">Provide your registered email</div>
              </div>
            </div>

            <div
              className={`flex items-center gap-3 transition-all cursor-pointer p-3 rounded-lg ${step >= 2 ? 'opacity-100 bg-white/10' : 'opacity-50 hover:opacity-70'
                } ${!contact ? 'cursor-not-allowed' : ''}`}
              onClick={() => contact && handleStepClick(2)}
            >
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-white/20' : 'bg-white/10'
                }`}>
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Step 2: Verify OTP</div>
                <div className="text-sm text-white/80">Enter the code sent to your email</div>
              </div>
            </div>

            <div
              className={`flex items-center gap-3 transition-all cursor-pointer p-3 rounded-lg ${step >= 3 ? 'opacity-100 bg-white/10' : 'opacity-50 hover:opacity-70'
                } ${!(contact && otp.join("").length === 6) ? 'cursor-not-allowed' : ''}`}
              onClick={() => contact && otp.join("").length === 6 && handleStepClick(3)}
            >
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-white/20' : 'bg-white/10'
                }`}>
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Step 3: New Password</div>
                <div className="text-sm text-white/80">Create a strong password</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-12 bg-white">
          {step === 1 && (
            <div>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter Your Email</h2>
                <p className="text-gray-600">We'll send a verification code to your email address</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900">Email Address *</label>
                  <Input
                    type="email"
                    placeholder="Enter your registered email"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="h-12"
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleSendOTP}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg"
                  disabled={loading || !contact}
                >
                  {loading ? "Sending OTP..." : "Send OTP"}
                </Button>

                <Button
                  variant="link"
                  className="w-full text-blue-600"
                  asChild
                >
                  <Link to="/login">Back to Login</Link>
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify OTP</h2>
                <p className="text-gray-600">
                  Enter the 6-digit code sent to <span className="font-semibold text-gray-900">{contact}</span>
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="text-sm font-medium text-gray-900">Verification Code *</label>
                  <div className="flex justify-between gap-2" onPaste={handleOtpPaste}>
                    {otp.map((digit, index) => (
                      <Input
                        key={index}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        ref={(el) => (inputRefs.current[index] = el)}
                        className="h-14 w-14 text-center text-2xl font-semibold"
                      />
                    ))}
                  </div>
                </div>
                {error && (
                  <div className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleVerifyOTP}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg"
                  disabled={loading || !isOtpComplete}
                >
                  {loading ? "Verifying..." : "Verify OTP"}
                </Button>

                <div className="text-center">
                  <span className="text-sm text-gray-600">Didn't receive the code? </span>
                  <Button
                    variant="link"
                    className="text-blue-600 p-0 h-auto"
                    onClick={handleResendOTP}
                    disabled={!canResend}
                  >
                    {canResend ? "Resend OTP" : `Resend OTP in ${resendTimer}s`}
                  </Button>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setStep(1);
                    setOtp(["", "", "", "", "", ""]);
                    setOtpId(null);
                    setError("");
                  }}
                >
                  Change Email
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="mb-4">
                <div className="flex items-center justify-center ">
                  <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 text-center">Create New Password</h2>
                <p className="text-gray-600 text-center">Your identity has been verified. Set a new password for your account</p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900">New Password *</label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-12 pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">
                      Password must be 8-20 characters with uppercase, lowercase, number, and special character
                    </p>
                    {passwordStrength && (
                      <p className={`text-xs ${getPasswordStrengthColor()}`}>
                        {getPasswordStrengthText()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900">Confirm Password *</label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-12 pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleResetPassword}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg"
                  disabled={loading || !newPassword || !confirmPassword}
                >
                  {loading ? "Resetting Password..." : "Reset Password"}
                </Button>

                <div className="text-center">
                  <span className="text-sm text-gray-600">
                    Got password?{" "}
                    <Button variant="link" className="text-blue-600 p-0 h-auto" asChild>
                      <Link to="/login">Back to Login</Link>
                    </Button>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;