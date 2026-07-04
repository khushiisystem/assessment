import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useEffect, useState, useRef } from "react";
import {
  User,
  Upload,
  Mail,
  Phone,
  CheckCircle,
  Shield,
  Key,
  Camera,
  Calendar,
  Download,
  Eye,
  EyeOff,
  Plus,
  X,
  Code,
  CreditCard,
  Briefcase,
  Search,
  ChevronDown,
  Check , Pencil ,
} from "lucide-react";
import UserLayout from "@/components/UserLayout";
import AdminLayout from "@/components/AdminLayout";
import { tokenStorage } from "@/lib/tokenStorage";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { TECH_OPTIONS } from "@/lib/techOptions";
import { useToast } from "@/components/ui/use-toast";
import {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useLazyGetCandidateResumeQuery,
  useGetOrganizationsQuery,
} from "@/store";

// Types
interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  profile: string;
  role: string;
  memberSince: string;
  lastLogin: string;
  username: string;
  resumeUrl?: string;
  professionalSummary: string;
  projects: string[];
  techStack: string[];
  servicesWorkedOn: string[];
  paymentMethodsUsed: string[];
  organizationId?: number;
  organizationName?: string;
}

interface ApiProfileData {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  profile: string;
  role: string;
  date_joined: string;
  resume_s3_url: string;
  avatar?: string;
  organization_id?: number;
  organization_name?: string;
  professional_summary?: string;
  projects?: string[];
  tech_stack?: string[];
  services_worked_on?: string[];
  payment_methods_used?: string[];
  learning_assignments: LearningAssignment[];
}

interface LearningAssignment {
  assignment_id: number;
  technology_id: string;
  technology_name: string;
  assigned_at: string;
  due_at: string | null;
  notes: string | null;
}

// Constants
const PROFESSIONAL_SUMMARY_MAX_LENGTH = 500;
const DB_NAME = 'ResumeFilenamesDB';
const DB_VERSION = 1;
const STORE_NAME = 'resumeFilenames';

// IndexedDB helper functions
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 's3Url' });
      }
    };
  });
};

const saveFilenameToIndexedDB = async (s3Url: string, filename: string): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({ s3Url, filename, updatedAt: Date.now() });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = reject;
    });
    db.close();
  } catch (error) {
    console.error('Error saving to IndexedDB:', error);
  }
};

const getFilenameFromIndexedDB = async (s3Url: string): Promise<string | null> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(s3Url);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        resolve(request.result?.filename || null);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error reading from IndexedDB:', error);
    return null;
  }
};

const getAllFilenamesFromIndexedDB = async (): Promise<Map<string, string>> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        const map = new Map<string, string>();
        request.result.forEach(item => {
          map.set(item.s3Url, item.filename);
        });
        resolve(map);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error reading all from IndexedDB:', error);
    return new Map();
  }
};

// Professional Fields Section with Searchable Dropdowns
const ProfessionalFieldsSection: React.FC<{
  techStack: string[];
  servicesWorkedOn: string[];
  paymentMethodsUsed: string[];
  professionalSummary: string;
  projects: string[];
  onAddTag: (field: 'techStack' | 'servicesWorkedOn' | 'paymentMethodsUsed', value: string) => void;
  onRemoveTag: (field: 'techStack' | 'servicesWorkedOn' | 'paymentMethodsUsed', index: number) => void;
  setForm: React.Dispatch<React.SetStateAction<ProfileData>>;
}> = ({
  techStack,
  servicesWorkedOn,
  paymentMethodsUsed,
  professionalSummary,
  projects,
  onAddTag,
  onRemoveTag,
  setForm,
}) => {
    // Options for searchable selects
    const SERVICE_OPTIONS = [
      'REST APIs', 'Microservices', 'Authentication Systems', 'Web Development',
      'Mobile Development', 'Cloud Architecture', 'DevOps', 'UI/UX Design',
      'API Integration', 'Database Design', 'Performance Optimization',
      'Security Audit', 'Technical Writing', 'Code Review', 'System Design',
      'CI/CD Pipeline', 'Testing & QA', 'Migration Services', 'Legacy Modernization',
      'Real-time Applications', 'E-commerce Solutions', 'CMS Development', 'Salesforce',
      'SAP', 'Oracle', 'ServiceNow', 'Tableau', 'Power BI', 'Snowflake',
      'ElasticSearch', 'Kafka', 'RabbitMQ', 'Ansible', 'Terraform', 'Jenkins',
      'GitLab CI/CD', 'CircleCI', 'Travis CI', 'Data Analysis', 'Data Visualization',
      'Predictive Modeling', 'Natural Language Processing', 'azure devops', 'aws cloud',
      'google cloud platform', 'cloud security', 'cloud migration', 'cloud cost optimization',
      'bootstrap', 'material-ui', 'ant-design', 'chakra-ui', 'semantic-ui', 'bulma', 'foundation',

    ];

    const PAYMENT_OPTIONS = [
      'Razorpay', 'Stripe', 'PayPal', 'Square', 'Adyen', 'Braintree',
      'PayU', 'Cashfree', 'Instamojo', 'Paytm Gateway', 'Authorize.net',
      '2Checkout', 'Amazon Pay', 'Google Pay', 'Apple Pay', 'Venmo',
      'Crypto Payments', 'Blockchain', 'UPI', 'PhonePe',
    ];

    const handleRemoveByValue = (field: 'techStack' | 'servicesWorkedOn' | 'paymentMethodsUsed', value: string) => {
      const index = (field === 'techStack' ? techStack : field === 'servicesWorkedOn' ? servicesWorkedOn : paymentMethodsUsed).indexOf(value);
      if (index !== -1) {
        onRemoveTag(field, index);
      }
    };

    const handleAddTagWrapper = (field: 'techStack' | 'servicesWorkedOn' | 'paymentMethodsUsed', value: string) => {
      onAddTag(field, value);
    };
    const [newProject, setNewProject] = useState("");

    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-5">
            {/* Professional Summary */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                Professional Summary<span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Textarea
                  value={professionalSummary}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, professionalSummary: e.target.value }))
                  }
                  placeholder="Summarize your professional background, key skills, and achievements"
                  className="min-h-[100px] text-xs border-slate-200 resize-none focus:ring-2 focus:ring-blue-500/20 rounded-lg"
                  maxLength={PROFESSIONAL_SUMMARY_MAX_LENGTH}
                />
                <span className="absolute bottom-2 right-2 text-[10px] text-slate-400 pointer-events-none">
                  {professionalSummary.length}/{PROFESSIONAL_SUMMARY_MAX_LENGTH}
                </span>
              </div>
            </div>

            {/* Tech Stack - Searchable Dropdown */}
            <SearchableSelect
              options={TECH_OPTIONS}
              selected={techStack}
              onSelect={(val) => handleAddTagWrapper('techStack', val)}
              onRemove={(val) => handleRemoveByValue('techStack', val)}
              placeholder="Search and select technologies..."
              label="Tech Stack"
              icon={<Code className="w-3.5 h-3.5" />}
              variant="blue"
            />

            {/* Services - Searchable Dropdown */}
            <SearchableSelect
              options={SERVICE_OPTIONS}
              selected={servicesWorkedOn}
              onSelect={(val) => handleAddTagWrapper('servicesWorkedOn', val)}
              onRemove={(val) => handleRemoveByValue('servicesWorkedOn', val)}
              placeholder="Search and select services..."
              label="Services"
              icon={<Briefcase className="w-3.5 h-3.5" />}
              variant="emerald"
            />

            {/* Payment Methods - Searchable Dropdown */}
            <SearchableSelect
              options={PAYMENT_OPTIONS}
              selected={paymentMethodsUsed}
              onSelect={(val) => handleAddTagWrapper('paymentMethodsUsed', val)}
              onRemove={(val) => handleRemoveByValue('paymentMethodsUsed', val)}
              placeholder="Search and select payment methods..."
              label="Payment Methods Used"
              icon={<CreditCard className="w-3.5 h-3.5" />}
              variant="purple"
            />
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="flex flex-col gap-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Projects
            </Label>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (!newProject.trim()) return;

                      setForm((prev) => ({
                        ...prev,
                        projects: [...(prev.projects || []), newProject.trim()],
                      }));

                      setNewProject("");
                    }}
                    className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3"
                  >
                    Add
                  </Button>
              </div>

              <Textarea
                value={newProject}
                onChange={(e) => setNewProject(e.target.value)}
                placeholder="Describe or enter project name..."
                className="min-h-[80px] text-xs border-slate-200 resize-none focus:ring-2 focus:ring-blue-500/20 rounded-lg mb-3"
              />

              <div className="flex flex-col gap-2">
                {(projects || []).length > 0 ? (
                  projects.map((proj, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between text-xs bg-slate-50 border border-slate-200 rounded-md px-3 py-2 gap-2"
                    >
                      {/* TEXT (wrapped) */}
                      <span className="text-slate-700 whitespace-pre-wrap break-all flex-1">
                        {proj}
                      </span>

                      {/* DELETE BUTTON */}
                      <button
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            projects: (prev.projects || []).filter((_, i) => i !== index),
                          }));
                        }}
                        className="text-slate-400 hover:text-red-500 flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No projects added
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

// Custom hooks
const useProfileManagement = () => {
  const { toast } = useToast();

  const { data: profileQueryData, isLoading: profileQueryLoading, refetch: refetchProfile } = useGetProfileQuery();
  const [updateProfileMutation] = useUpdateProfileMutation();
  const [changePasswordMutation] = useChangePasswordMutation();

  const [activeTab, setActiveTab] = useState("personal");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState<ProfileData>({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    profile: "",
    role: "Candidate",
    memberSince: "",
    lastLogin: "",
    username: "",
    resumeUrl: "",
    professionalSummary: "",
    projects: [],
    techStack: [],
    servicesWorkedOn: [],
    paymentMethodsUsed: []
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [profileImage, setProfileImage] = useState<string>("");
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [currentprofileData, setCurrentProfileData] = useState<ApiProfileData | null>(null);
  const [originalResumeFileName, setOriginalResumeFileName] = useState<string>("");
  const [filenameMap, setFilenameMap] = useState<Map<string, string>>(new Map());

  // Load all stored filenames from IndexedDB on mount
  useEffect(() => {
    const loadStoredFilenames = async () => {
      const map = await getAllFilenamesFromIndexedDB();
      setFilenameMap(map);
    };
    loadStoredFilenames();
  }, []);

  const addTag = (field: 'techStack' | 'servicesWorkedOn' | 'paymentMethodsUsed', value: string) => {
    if (value.trim() && !form[field].includes(value.trim())) {
      setForm(prev => ({
        ...prev,
        [field]: [...prev[field], value.trim()]
      }));
      toast({
        title: "Added",
        description: `${value} added`,
        duration: 1500,
        variant: "success",
      });
    }
  };

  const removeTag = (field: 'techStack' | 'servicesWorkedOn' | 'paymentMethodsUsed', index: number) => {
    const removedItem = form[field][index];
    setForm(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
    toast({
      title: "Removed",
      description: `${removedItem} removed`,
      duration: 1500,
      variant: "default",
    });
  };

  const handleUpdateProfile = async () => {
    setIsSaving(true);
    try {
      const formData = new FormData();

      formData.append("first_name", form.firstName);
      formData.append("last_name", form.lastName);
      formData.append("phone", form.mobile);
      formData.append("profile", form.profile);
      formData.append("professional_summary", form.professionalSummary);
      formData.append("tech_stack", JSON.stringify(form.techStack));
      formData.append("services_worked_on", JSON.stringify(form.servicesWorkedOn));
      formData.append("payment_methods_used", JSON.stringify(form.paymentMethodsUsed));
      formData.append("projects", JSON.stringify(form.projects));

      if (resumeFile) {
        formData.append("resume", resumeFile);
      }

      if (profileImageFile) {
        formData.append("avatar", profileImageFile);
      }

      await updateProfileMutation(formData).unwrap();

      toast({
        title: "Success",
        description: "Profile updated successfully!",
        duration: 3000,
        variant: "success",
      });

      await refetchProfile();
    } catch (error: any) {
      // Surface the real server error. DRF returns errors in several shapes:
      // a string, {detail}, {message}, or per-field arrays {field: ["msg", ...]}.
      console.error("Update profile failed:", error);
      const data = error?.data;
      let description = "Failed to update profile";
      if (typeof data === "string") {
        description = data;
      } else if (data?.detail) {
        description = data.detail;
      } else if (data?.message) {
        description = data.message;
      } else if (data && typeof data === "object") {
        const fieldErrors = Object.entries(data)
          .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(" ") : msgs}`)
          .join(" | ");
        if (fieldErrors) description = fieldErrors;
      }
      toast({
        title: "Failed",
        description,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Failed",
        description: "Please fill in all password fields",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    if (!strongPasswordRegex.test(newPassword)) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Matching Failed",
        description: "New passwords do not match",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    if (currentPassword === newPassword) {
      toast({
        title: "Invalid Password",
        description: "New password must be different from current password",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const data = await changePasswordMutation({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }).unwrap();

      if (data?.message === "Password updated.") {
        toast({
          title: "Success",
          description: "Password updated successfully!",
          duration: 3000,
          variant: "success",
        });

        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    } catch (error: any) {
      let errorMessage = error?.data?.detail || error?.data?.message || "Failed to change password. Please try again.";
      toast({
        title: "Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.type !== "application/pdf") {
        toast({
          title: "Invalid file",
          description: "Only PDF files are allowed",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload a PDF file under 5MB",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

    const originalName = file.name;
      setIsUploadingResume(true);

      try {
        const formData = new FormData();
        formData.append("resume", file);

        await updateProfileMutation(formData).unwrap();
        const refreshed = await refetchProfile();
        const updatedData = refreshed.data as ApiProfileData;

        if (updatedData?.resume_s3_url) {
          setResumeUrl(updatedData.resume_s3_url);
        // Save the original filename to IndexedDB using the S3 URL as key
        await saveFilenameToIndexedDB(updatedData.resume_s3_url, originalName);
        setOriginalResumeFileName(originalName);
        // Update the local map
        setFilenameMap(prev => new Map(prev).set(updatedData.resume_s3_url!, originalName));
        }

        toast({
          title: "Resume uploaded",
          description: `${originalName} uploaded successfully`,
          duration: 3000,
          variant: "success",
        });
      } catch (error) {
        const err = error as any;
        toast({
          title: "Upload failed",
          description: err.data?.message || "Failed to upload resume",
          variant: "destructive",
          duration: 3000,
        });
      } finally {
        setResumeFile(null);
        setIsUploadingResume(false);
      }
    };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file",
          description: "Only image files are allowed",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "Too large",
          description: "Image must be less than 2MB",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      setProfileImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (profileQueryData) {
      const data = profileQueryData as ApiProfileData;
      console.log("Profile data loaded:", data);
      setCurrentProfileData(data);
      setProfileImage(data.avatar || "");
      setForm({
        firstName: data.first_name || "",
        lastName: data.last_name || "",
        email: data.email || "",
        profile: data.profile || "",
        mobile: data.phone || "",
        role: data.role || "candidate",
        memberSince: data.date_joined ? new Date(data.date_joined).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : "",
        lastLogin: new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        username: data.username || "",
        resumeUrl: data.resume_s3_url || "",
        professionalSummary: data.professional_summary || "",
        projects: data.projects || [],
        techStack: data.tech_stack || [],
        servicesWorkedOn: data.services_worked_on || [],
        paymentMethodsUsed: data.payment_methods_used || []
      });
      setResumeUrl(data.resume_s3_url || null);

      // Try to get the original filename from IndexedDB
      if (data.resume_s3_url) {
        const loadFilename = async () => {
          const storedFilename = await getFilenameFromIndexedDB(data.resume_s3_url);
          if (storedFilename) {
            setOriginalResumeFileName(storedFilename);
          } else {
            // Fallback: extract from URL
            const urlParts = data.resume_s3_url.split('/');
            let filename = urlParts.pop() || '';
            filename = filename.split('?')[0];
            try {
              filename = decodeURIComponent(filename);
              setOriginalResumeFileName(filename);
            } catch (e) {
              console.warn('Failed to decode filename:', e);
              setOriginalResumeFileName("Resume uploaded");
            }
          }
        };
        loadFilename();
      }
    }
  }, [profileQueryData]);

  useEffect(() => {
    if (profileQueryData?.avatar) {
      setProfileImage(profileQueryData.avatar);
    }
  }, [profileQueryData]);

  return {
    activeTab,
    setActiveTab,
    form,
    setForm,
    passwordForm,
    setPasswordForm,
    resumeFile,
    setResumeFile,
    resumeUrl,
    setResumeUrl,
    isUploadingResume,
    profileImage,
    setProfileImage,
    setProfileImageFile,
    currentprofileData,
    isLoading,
    isSaving,
    isChangingPassword,
    showCurrentPassword,
    setShowCurrentPassword,
    showNewPassword,
    setShowNewPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    profileQueryLoading,
    addTag,
    removeTag,
    handleUpdateProfile,
    handleChangePassword,
    refetchProfile,
    handleFileChange,
    handleImageUpload,
    originalResumeFileName,
    filenameMap,
  };
};

const Profile: React.FC = () => {
  const profileManagement = useProfileManagement();
  const { toast } = useToast();
  // Org/super admins reach this page from the admin shell, so render it inside
  // the admin layout (sidebar/nav) instead of the candidate layout. Role is read
  // synchronously from storage to avoid a layout flicker before the profile loads.
  const storedRole = tokenStorage.getUser<{ role?: string }>()?.role;
  const ProfileLayout =
    storedRole === "org_admin" || storedRole === "super_admin" || storedRole === "manager"
      ? AdminLayout
      : UserLayout;
  const [getCandidateResume] = useLazyGetCandidateResumeQuery();
  const { data: organizations, isLoading: isLoadingOrganizations } = useGetOrganizationsQuery();

  const {
    activeTab,
    setActiveTab,
    form,
    setForm,
    passwordForm,
    setPasswordForm,
    resumeFile,
    setResumeFile,
    resumeUrl,
    setResumeUrl,
    isUploadingResume,
    profileImage,
    currentprofileData,
    isLoading,
    isSaving,
    isChangingPassword,
    showCurrentPassword,
    setShowCurrentPassword,
    showNewPassword,
    setShowNewPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    profileQueryLoading,
    addTag,
    removeTag,
    handleUpdateProfile,
    handleChangePassword,
    refetchProfile,
    handleFileChange,
    handleImageUpload,
    originalResumeFileName,
    filenameMap,
  } = profileManagement;

  const getInitials = () => {
    if (!form.firstName && !form.lastName) return "AN";
    return `${form.firstName?.[0] || ""}${form.lastName?.[0] || ""}`.toUpperCase();
  };

  // Helper function to get display filename
  const getDisplayFileName = (): string => {
    // Priority 1: Use the original filename from state
    if (originalResumeFileName && originalResumeFileName !== "Resume uploaded") {
      return originalResumeFileName;
    }

    // Priority 2: Check the filenameMap for the current S3 URL
    if (currentprofileData?.resume_s3_url && filenameMap.has(currentprofileData.resume_s3_url)) {
      return filenameMap.get(currentprofileData.resume_s3_url)!;
    }

    // Priority 3: Extract from S3 URL (fallback)
    if (currentprofileData?.resume_s3_url) {
      const urlParts = currentprofileData.resume_s3_url.split('/');
      let filename = urlParts.pop() || '';
      filename = filename.split('?')[0];
      try {
        filename = decodeURIComponent(filename);
        // Try to clean up the filename (remove UUID prefixes if present)
        const match = filename.match(/([^\/]+\.pdf)$/i);
        if (match) {
          return match[1];
        }
        return filename;
      } catch (e) {
        console.warn('Failed to decode filename:', e);
      }
    }

    return "✗ Not uploaded";
  };

  return (
    <ProfileLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-9xl mx-auto">
          {(isLoading || profileQueryLoading) ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <PageHeader
                title={
        <div className="flex items-center gap-4">
      
      {/* Avatar Block */}
      <div className="flex flex-col items-center relative">
        <div className="relative">
          <Avatar className="h-16 w-16 ring-2 ring-white shadow-sm bg-white transition-transform hover:scale-105">
            <AvatarImage
              src={profileImage ? profileImage : currentprofileData?.avatar}
              className="object-cover"
            />
            <AvatarFallback className="bg-gradient-to-br from-blue-50 to-slate-100 text-blue-700 text-sm font-bold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>

          <label
            className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 
                       bg-white border border-slate-200 rounded-full p-1 shadow 
                       cursor-pointer hover:bg-slate-100 transition"
          >
            <Pencil className="w-3 h-3 text-slate-600" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </label>
        </div>

        <span className="text-xs font-semibold text-slate-600 px-3 py-1">
          Photo<span className="text-red-500">*</span>
        </span>
      </div>

      {/* Name + Description */}
      <div className="flex flex-col">
        <span className="text-lg font-semibold text-slate-800">
          {
                  form.firstName || form.lastName
                    ? `${form.firstName} ${form.lastName}`
                    : "My Profile"
                }
        </span>

        <span className="text-sm text-slate-500">
          Manage your profile and account settings
        </span>
      </div>
    </div>
  }
                className="mb-4"
              />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Main Content - Tabs */}
                <div className="lg:col-span-2">
                  <Card className="border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <div className="bg-slate-50/80 px-6 pt-6 border-b border-slate-100">
                        <TabsList className="grid w-full max-w-sm grid-cols-2 p-1 bg-slate-200/50 rounded-lg mb-6">
                          <TabsTrigger value="personal" className="flex items-center gap-2 text-xs font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm rounded-md">
                            <User className="w-4 h-4" />
                            Personal Info
                          </TabsTrigger>
                          <TabsTrigger value="security" className="flex items-center gap-2 text-xs font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm rounded-md">
                            <Shield className="w-4 h-4" />
                            Security Settings
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      <CardContent className="p-6">
                        {/* Personal Info Tab */}
                        <TabsContent value="personal" className="space-y-6 mt-0">
                          {/* Name Fields */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-1.5 flex flex-col">
                              <Label htmlFor="firstName" className="text-xs font-semibold tracking-tight text-slate-700 ml-0.5">
                                First Name <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id="firstName"
                                value={form.firstName}
                                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                                placeholder="First name"
                                className="h-9 text-sm bg-slate-50/50 border-slate-200 transition-all duration-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                              />
                            </div>

                            <div className="space-y-1.5 flex flex-col">
                              <Label htmlFor="lastName" className="text-xs font-semibold tracking-tight text-slate-700 ml-0.5">
                                Last Name <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id="lastName"
                                value={form.lastName}
                                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                                placeholder="Last name"
                                className="h-9 text-sm bg-slate-50/50 border-slate-200 transition-all duration-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                              />
                            </div>
                          </div>

                          {/* Email and Profile Title */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-1.5 flex flex-col">
                              <Label htmlFor="email" className="text-xs font-semibold tracking-tight text-slate-700 ml-0.5">
                                Email Address <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id="email"
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="user@example.com"
                                className="h-9 text-sm border-slate-200 bg-slate-100/80 text-slate-500 cursor-not-allowed font-medium"
                                disabled={true}
                              />
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                              <Label htmlFor="profile" className="text-xs font-semibold tracking-tight text-slate-700 ml-0.5">
                                Professional Title <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id="profile"
                                value={form.profile}
                                onChange={(e) => setForm({ ...form, profile: e.target.value })}
                                placeholder="e.g. Senior Software Engineer"
                                className="h-9 text-sm bg-slate-50/50 border-slate-200 transition-all duration-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                              />
                            </div>
                          </div>

                          {/* Mobile + Resume Row */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Mobile Number */}
                            <div className="space-y-1.5 flex flex-col">
                              <Label htmlFor="mobile" className="text-xs font-semibold tracking-tight text-slate-700 ml-0.5">
                                Mobile Number <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id="mobile"
                                type="tel"
                                value={form.mobile}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, "");
                                  if (value.length <= 10) {
                                    setForm({ ...form, mobile: value });
                                  }
                                }}
                                placeholder="10-digit number"
                                className={`h-9 text-sm w-full max-w-xs transition-all duration-200
                                  ${
                                    form.mobile.length > 0 && form.mobile.length < 10
                                      ? "border-red-500 focus:ring-red-500/20"
                                      : "bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-blue-500/20"
                                  }`}
                              />

                              {/* Warning Message ONLY */}
                              {form.mobile.length > 0 && form.mobile.length < 10 && (
                                <span className="text-[11px] text-red-500 font-medium">
                                  Mobile number must be 10 digits
                                </span>
                              )}
                            </div>

                            {/* Resume Upload */}
                            <div className="space-y-1.5 flex flex-col">
                              <Label className="text-xs font-semibold tracking-tight text-slate-700 ml-0.5">
                                Resume PDF (Max 5MB)<span className="text-red-500">*</span>
                              </Label>
                              <div className="flex items-center h-9 max-w-xs bg-slate-50/50 border border-slate-200 rounded-md overflow-hidden">
                                <span className="flex-1 px-3 text-sm text-slate-600 truncate" title={getDisplayFileName()}>
                                  {isUploadingResume
                                    ? "Uploading..."
                                    : resumeUrl
                                      ? getDisplayFileName()
                                      : "No file chosen"}
                                </span>
                                <label
                                  htmlFor="resumeFile"
                                  className={`h-full px-3 flex items-center text-xs font-medium text-white cursor-pointer transition ${isUploadingResume
                                    ? "bg-blue-400 pointer-events-none"
                                    : resumeUrl
                                      ? "bg-green-600 hover:bg-green-700"
                                      : "bg-blue-600 hover:bg-blue-700"
                                    }`}
                                >
                                  {isUploadingResume
                                    ? "Uploading..."
                                    : resumeUrl
                                      ? "Update"
                                      : "Upload"}
                                </label>
                              </div>
                              <input
                                id="resumeFile"
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                onChange={handleFileChange}
                                disabled={isUploadingResume}
                              />
                            </div>
                          </div>

                          {/* Separator */}
                          <div className="my-6">
                            <Separator className="bg-slate-100" />
                          </div>

                          {/* Professional Fields with Searchable Dropdowns */}
                          <ProfessionalFieldsSection
                            techStack={form.techStack}
                            servicesWorkedOn={form.servicesWorkedOn}
                            paymentMethodsUsed={form.paymentMethodsUsed}
                            professionalSummary={form.professionalSummary}
                            projects={form.projects}
                            onAddTag={addTag}
                            onRemoveTag={removeTag}
                            setForm={setForm}
                          />

                          {/* Save/Cancel Buttons */}
                          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={refetchProfile}
                              className="text-xs transition-all duration-200 hover:bg-red-300 border-slate-200"
                            >
                              Discard Changes
                            </Button>
                            <Button
                              type="button"
                              onClick={handleUpdateProfile}
                              disabled={isSaving}
                              className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-xs shadow-sm"
                            >
                              {isSaving ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                  Saving Changes...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-3.5 h-3.5 mr-2" />
                                  Save Profile
                                </>
                              )}
                            </Button>
                          </div>
                        </TabsContent>

                        {/* Security Tab - Password Change */}
                        <TabsContent value="security" className="space-y-6 mt-0">
                          <div className="rounded-xl border border-amber-200/50 bg-amber-50/50 p-4">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-amber-100/80 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Shield className="w-5 h-5 text-amber-600" />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-sm font-semibold text-amber-900 mb-0.5 tracking-tight">Password Security</h3>
                                <p className="text-xs text-amber-700/80 max-w-lg">
                                  Keep your account secure by changing your password regularly. Make sure it's at least 8 characters and includes uppercase, lowercase, number, and special character.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label htmlFor="currentPassword" className="text-xs font-medium text-slate-700">
                                Current Password <span className="text-red-500">*</span>
                              </Label>
                              <div className="relative">
                                <Input
                                  id="currentPassword"
                                  type={showCurrentPassword ? "text" : "password"}
                                  value={passwordForm.currentPassword}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                  placeholder="Enter current password"
                                  className="h-8 text-xs pr-8 transition-all duration-200 focus:ring-2 focus:ring-blue-500/20"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors duration-200"
                                >
                                  {showCurrentPassword ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <Label htmlFor="newPassword" className="text-xs font-medium text-slate-700">
                                New Password <span className="text-red-500">*</span>
                              </Label>
                              <div className="relative">
                                <Input
                                  id="newPassword"
                                  type={showNewPassword ? "text" : "password"}
                                  value={passwordForm.newPassword}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                  placeholder="Enter new password"
                                  className="h-8 text-xs pr-8 transition-all duration-200 focus:ring-2 focus:ring-blue-500/20"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowNewPassword(!showNewPassword)}
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors duration-200"
                                >
                                  {showNewPassword ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <Label htmlFor="confirmPassword" className="text-xs font-medium text-slate-700">
                                Confirm New Password <span className="text-red-500">*</span>
                              </Label>
                              <div className="relative">
                                <Input
                                  id="confirmPassword"
                                  type={showConfirmPassword ? "text" : "password"}
                                  value={passwordForm.confirmPassword}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                  placeholder="Confirm new password"
                                  className="h-8 text-xs pr-8 transition-all duration-200 focus:ring-2 focus:ring-blue-500/20"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors duration-200"
                                >
                                  {showConfirmPassword ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setPasswordForm({
                                    currentPassword: "",
                                    newPassword: "",
                                    confirmPassword: ""
                                  });
                                }}
                                className="text-xs transition-all duration-200 hover:bg-slate-50 border-slate-200"
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleChangePassword}
                                disabled={isChangingPassword || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                                className="bg-slate-900 hover:bg-slate-800 text-white transition-all duration-200 text-xs shadow-sm"
                              >
                                {isChangingPassword ? (
                                  <>
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                    Updating...
                                  </>
                                ) : (
                                  <>
                                    <Key className="w-3.5 h-3.5 mr-2" />
                                    Change Password
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </TabsContent>
                      </CardContent>
                    </Tabs>
                  </Card>
                </div>

                {/* Right Sidebar - Account Info */}
                <div className="space-y-6">
                  <Card className="border-slate-200/60 shadow-sm overflow-hidden sticky top-6">
                    <div className="bg-slate-50/80 px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                      <div className="p-1.5 bg-blue-100/50 rounded-md">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <h2 className="text-sm font-semibold tracking-tight text-slate-800">Account Overview</h2>
                    </div>
                    <CardContent className="p-5 space-y-5">
                      <div className="space-y-3">
                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                            Username
                          </p>
                          <p className="text-xs font-semibold text-blue-800">{currentprofileData?.username || form.username}</p>
                        </div>

                        <Separator />

                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                            Profile
                          </p>
                          {currentprofileData?.profile || form.profile ? (
                            <Badge variant="secondary" className="text-xs capitalize bg-blue-100 text-blue-800">
                              {currentprofileData?.profile || form.profile}
                            </Badge>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">No profile title set</p>
                          )}
                        </div>

                        <Separator />

                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                            Email
                          </p>
                          <p className="text-xs text-blue-800 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {currentprofileData?.email || form.email}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                            Phone
                          </p>
                          <p className="text-xs text-blue-800 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {currentprofileData?.phone || form.mobile}
                          </p>
                        </div>

                        <Separator />

                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                            Tech Stack
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {form.techStack.length > 0 ? (
                              form.techStack.slice(0, 3).map((tech, index) => (
                                <Badge key={index} className="bg-blue-50 text-blue-700 text-[10px] px-2 py-0.5 rounded-full">
                                  {tech}
                                </Badge>
                              ))
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">No tech stack added</p>
                            )}
                            {form.techStack.length > 3 && (
                              <Badge className="bg-purple-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">
                                +{form.techStack.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                            Services
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {form.servicesWorkedOn.length > 0 ? (
                              form.servicesWorkedOn.slice(0, 3).map((service, index) => (
                                <Badge key={index} className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full">
                                  {service}
                                </Badge>
                              ))
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">No services added</p>
                            )}
                            {form.servicesWorkedOn.length > 3 && (
                              <Badge className="bg-purple-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">
                                +{form.servicesWorkedOn.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                            Payment Methods used
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {form.paymentMethodsUsed.length > 0 ? (
                              form.paymentMethodsUsed.slice(0, 3).map((method, index) => (
                                <Badge key={index} className="bg-purple-50 text-purple-700 text-[10px] px-2 py-0.5 rounded-full">
                                  {method}
                                </Badge>
                              ))
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">No payment methods added</p>
                            )}
                            {form.paymentMethodsUsed.length > 3 && (
                              <Badge className="bg-purple-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">
                                +{form.paymentMethodsUsed.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                            Member Since
                          </p>
                          <p className="text-xs text-slate-700 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {currentprofileData?.date_joined
                              ? new Date(currentprofileData.date_joined).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })
                              : form.memberSince}
                          </p>
                        </div>

                        <Separator />

                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                            Resume Status
                          </p>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-xs text-slate-700 truncate"
                                title={getDisplayFileName()}
                              >
                                {currentprofileData?.resume_s3_url ? getDisplayFileName() : "✗ Not uploaded"}
                              </p>
                            </div>
                            {currentprofileData?.resume_s3_url && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const data = await getCandidateResume(currentprofileData.id).unwrap();
                                    if (data?.url) window.open(data.url, "_blank");
                                  } catch {
                                    toast({
                                      title: "Error",
                                      description: "Failed to download resume.",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                className="text-xs flex-shrink-0"
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {form.professionalSummary && (
                          <>
                            <Separator />
                            <div>
                              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                                Professional Summary
                              </p>
                              <p className="text-xs text-slate-700 whitespace-pre-wrap break-words">
                                {form.professionalSummary}
                              </p>
                            </div>
                          </>

                        )}
                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 uppercase mb-1.5">
                            Projects
                          </p>

                          <div className="flex flex-col gap-2">
                            {form.projects.length > 0 ? (
                              form.projects.slice(0, 3).map((proj, index) => (
                                <div
                                  key={index}
                                  className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 break-words whitespace-pre-wrap"
                                >
                                  {proj}
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">No projects added</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </ProfileLayout>
  );
};
export default Profile;