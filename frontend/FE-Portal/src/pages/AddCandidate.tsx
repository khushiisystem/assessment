import React from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { useToast } from "@/components/ui/use-toast";
import {
  X,
  Info,
  AlertTriangle,
  ArrowLeft,
  UserPlus,
  Upload,
  Users,
} from "lucide-react";
import { useAddCandidateMutation } from "@/store";
import { PageHeader } from "@/components/common/PageHeader";
import { CARD_SHADOW, INPUT_CLASS } from "@/lib/uiStyles";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export const AddCandidate = () => {
  const [addCandidate] = useAddCandidateMutation();
  const [formData, setFormData] = React.useState({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    profile: ""
  });
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // Check file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload a PDF or DOC file only.",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      // Check file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please upload a file smaller than 5MB.",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.username || !formData.firstName || !formData.email || !formData.phone || !formData.profile) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Phone validation
    const cleanedPhone = formData.phone.replace(/\D/g, '');
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(cleanedPhone)) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid 10-digit phone number.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setIsLoading(true);

    try {
      const submitData = new FormData();

      // Append required fields
      submitData.append("username", formData.username); 
      submitData.append("email", formData.email);
      submitData.append("first_name", formData.firstName);
      submitData.append("last_name", formData.lastName);
      submitData.append("phone", cleanedPhone);
      submitData.append("profile", formData.profile);

      // Append resume file if selected
      if (selectedFile) {
        submitData.append("resume", selectedFile);
      }

      await addCandidate(submitData).unwrap();

      toast({
        title: "Candidate Added Successfully",
        description: "The candidate has been created successfully.",
        variant: "success",
        duration: 3000,
      });

      // Reset form and navigate back
      setFormData({
        username: "",
        email: "",
        firstName: "",
        lastName: "",
        phone: "",
        profile: "",
      });
      setSelectedFile(null);

      // Navigate back to candidates list after a short delay
      setTimeout(() => {
        navigate("/admin/candidates");
      }, 1000);

    } catch (error: any) {
      console.error("Error adding candidate:", error);

      let errorMessage = "Failed to add candidate. Please try again.";

      if (error.data) {
        const errorData = error.data;
        if (errorData.email) {
          errorMessage = `Email error: ${errorData.email[0]}`;
        } else if (errorData.phone) {
          errorMessage = `Phone error: ${errorData.phone[0]}`;
        } else if (errorData.first_name) {
          errorMessage = `Name error: ${errorData.first_name[0]}`;
        } else if (errorData.profile) {
          errorMessage = `Profile error: ${errorData.profile[0]}`;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      }

      toast({
        title: "Add Candidate Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <PageHeader
            icon={UserPlus}
            title="Add New Candidate"
            description="Create a candidate account and optionally attach a résumé."
            actions={
              <button
                onClick={() => navigate(-1)}
                title="Back to Candidates"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-brand-violet/40 hover:bg-violet-50/60 hover:text-brand-violet"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            }
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Form */}
            <div className="lg:col-span-2">
              <div className={`overflow-hidden rounded-2xl border border-slate-200/70 bg-white ${CARD_SHADOW}`}>
                <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
                    <Users className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold tracking-tight text-slate-900">Candidate Details</h2>
                    <p className="text-xs text-slate-500">Fields marked * are required.</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 p-5">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field label="Username" required>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => handleInputChange("username", e.target.value)}
                        placeholder="Enter username"
                        required
                        disabled={isLoading}
                        className={INPUT_CLASS}
                      />
                    </Field>
                    <Field label="Email" required>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        placeholder="name@example.com"
                        required
                        disabled={isLoading}
                        className={INPUT_CLASS}
                      />
                    </Field>
                    <Field label="First Name" required>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange("firstName", e.target.value)}
                        placeholder="Enter first name"
                        disabled={isLoading}
                        className={INPUT_CLASS}
                      />
                    </Field>
                    <Field label="Last Name">
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange("lastName", e.target.value)}
                        placeholder="Enter last name"
                        disabled={isLoading}
                        className={INPUT_CLASS}
                      />
                    </Field>
                    <Field label="Phone" required>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => {
                          const onlyNums = e.target.value.replace(/\D/g, "");
                          if (onlyNums.length <= 10) handleInputChange("phone", onlyNums);
                        }}
                        maxLength={10}
                        placeholder="10-digit phone number"
                        disabled={isLoading}
                        className={INPUT_CLASS}
                      />
                    </Field>
                    <Field label="Profile / Tech Stack" required>
                      <input
                        type="text"
                        value={formData.profile}
                        onChange={(e) => handleInputChange("profile", e.target.value)}
                        placeholder="e.g. Frontend Developer, React"
                        disabled={isLoading}
                        className={INPUT_CLASS}
                      />
                    </Field>
                  </div>

                  {/* Résumé */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Résumé <span className="font-normal text-slate-400">(PDF or DOC, max 5MB)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx"
                        disabled={isLoading}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                        className="flex flex-1 items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-600 transition-colors hover:border-brand-violet/50 hover:bg-violet-50/60 hover:text-brand-violet disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Upload className="h-4 w-4 shrink-0" />
                        <span className="truncate">{selectedFile ? selectedFile.name : "Choose a file…"}</span>
                      </button>
                      {selectedFile && (
                        <button
                          type="button"
                          onClick={clearFile}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          title="Remove file"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
                    <button
                      type="button"
                      onClick={() => navigate(-1)}
                      disabled={isLoading}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isLoading ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          Adding Candidate…
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" />
                          Add Candidate
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Tips */}
            <div className="lg:col-span-1">
              <div className={`rounded-2xl border border-slate-200/70 bg-white p-5 lg:sticky lg:top-4 ${CARD_SHADOW}`}>
                <h2 className="mb-4 text-sm font-bold tracking-tight text-slate-900">Quick Tips</h2>

                <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-violet/10 text-brand-violet">
                      <Info className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-semibold text-slate-800">Candidate creation</span>
                  </div>
                  <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-600">
                    <li>Username should be unique and memorable</li>
                    <li>Email is required for sending credentials</li>
                    <li>Profile describes the candidate's tech stack / role</li>
                    <li>Résumé is optional</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-3.5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-semibold text-slate-800">Important notes</span>
                  </div>
                  <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-600">
                    <li>Credentials are emailed automatically</li>
                    <li>The candidate role is assigned automatically</li>
                    <li>For many candidates, use the Import feature</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};