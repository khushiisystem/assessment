import React from "react";
import * as Select from "@radix-ui/react-select";
import { useNavigate, useLocation } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { toast } from "@/hooks/use-toast";
import {
  UploadCloud,
  Download,
  Info,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  FileSpreadsheet,
  File,
  CheckCircle2,
  CloudUpload,
  Users,
  Brain
} from "lucide-react";
import { useLazyDownloadTemplateQuery, uploadWithProgress } from "@/store";
import { SECTION_TITLE, SUBSECTION_TITLE } from "@/lib/uiStyles";

export const BulkUpload: React.FC = () => {
  const [selectedTab, setSelectedTab] = React.useState<"candidates" | "questions" | "ai">("candidates");
  const [uploadType, setUploadType] = React.useState<string>("candidate");
  const [uploadedFiles, setUploadedFiles] = React.useState<string[]>([]);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const [downloadTemplateQuery] = useLazyDownloadTemplateQuery();
  const defaultTab = location.state?.defaultTab;
  const importType = location.state?.importType;

  React.useEffect(() => {
    if (defaultTab) {
      setSelectedTab(defaultTab);
    } else if (importType) {
      setSelectedTab(importType);
    }
    if (defaultTab === "candidates" || defaultTab === "questions" || defaultTab === "ai") {
      setSelectedTab(defaultTab);
      setUploadType(defaultTab === "candidates" ? "candidate" : defaultTab === "ai" ? "ai" : "question");
    }
  }, [location.state]);

  const handleTabChange = (key: "candidates" | "questions" | "ai") => {
    setSelectedTab(key);
    setUploadType(key === "candidates" ? "candidate" : key === "ai" ? "ai" : "question");
    setSelectedFile(null);
    setError("");
    setUploadProgress(0);
    navigate(`/admin/${key}`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (uploadedFiles.includes(file.name)) {
      setError(`File "${file.name}" has already been uploaded.`);
      return;
    }

    // Validate file type
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!validExtensions.includes(fileExtension || '')) {
      setError('Please select a valid Excel or CSV file.');
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('File size should not exceed 10MB.');
      return;
    }

    setSelectedFile(file);
    setUploadedFiles([...uploadedFiles, file.name]);
    setError("");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };
  const handleUpload = async () => {
    if (!selectedFile) {
      setError(`Please select a file to upload.`);
      return;
    }

    if (!uploadType) {
      setError(`Please select an upload type.`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Determine file_type based on file extension
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      let fileType = 'csv'; // default

      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        fileType = 'excel';
      } else if (fileExtension === 'csv') {
        fileType = 'csv';
      }

      // Add file_type parameter for all endpoints
      formData.append('file_type', fileType);

      // Add additional parameters based on upload type
      if (uploadType === 'ai') {
        const fileFormat = fileType === 'csv' ? 'csv' : 'excel';
        formData.append('file_format', fileFormat);
        // Add skip_errors parameter for AI questions
        formData.append('skip_errors', 'true');
      }

      // Define API endpoints based on upload type
      let endpoint = "";
      if (uploadType === "candidate") {
        endpoint = "/my-admin/candidates/import/";
      } else if (uploadType === "question") {
        endpoint = "/my-admin/questions/import/";
      } else if (uploadType === "ai") {
        endpoint = "/my-admin/questions/bulk-upload/";
      }

      const data = await uploadWithProgress(
        endpoint,
        formData,
        (pct) => setUploadProgress(pct),
      );

      // Reset upload state
      setUploadProgress(100);
      setSelectedFile(null);
      setUploadedFiles(prev => [...prev, selectedFile.name]);

      // Show success toast - handle different response structures
      let successMessage = "";
      let errorCount = 0;

      if (uploadType === "candidate") {
        successMessage = `${data.imported} candidates imported successfully.`;
        errorCount = data.failed || 0;
      } else if (uploadType === "question") {
        successMessage = `${data.created} questions created successfully.`;
        errorCount = data.failed || 0;
      } else if (uploadType === "ai") {
        successMessage = `AI questions uploaded successfully.`;
        errorCount = data.results?.errors?.length || 0;
      }

      toast({
        title: "Success!",
        description: `${successMessage}${errorCount > 0 ? ` ${errorCount} errors found.` : ''}`,
        variant: "success",
        duration: 5000,
      });

      // Show errors if any
      if (data.errors && data.errors.length > 0) {
        console.error("Upload errors:", data.errors);
        toast({
          title: "Upload Completed with Errors",
          description: `Found ${data.errors.length} errors. Check console for details.`,
          variant: "destructive",
          duration: 3000,
        });
      }

    } catch (error: any) {
      console.error("Upload failed:", error);

      let errorMessage = "Failed to upload file. Please try again.";

      if (error.response) {
        if (error.response.data) {
          if (typeof error.response.data === 'string') {
            errorMessage = error.response.data;
          } else if (error.response.data.detail) {
            errorMessage = error.response.data.detail;
          } else if (error.response.data.message) {
            errorMessage = error.response.data.message;
          }
        }
        if (error.response.status === 400) {
          // Try to get specific error messages from response
          if (error.response.data && typeof error.response.data === 'object') {
            // Handle field errors like {file_type: ["This field is required."]}
            const errors = error.response.data;
            if (errors.file_type) {
              errorMessage = `File type error: ${Array.isArray(errors.file_type) ? errors.file_type[0] : errors.file_type}`;
            } else if (errors.detail) {
              errorMessage = errors.detail;
            } else if (errors.message) {
              errorMessage = errors.message;
            } else if (errors.status === "error" && errors.message) {
              errorMessage = errors.message;
            }
          } else if (typeof error.response.data === 'string') {
            errorMessage = error.response.data;
          }
        } else if (error.response.status === 413) {
          errorMessage = "File too large. Please select a file under 10MB.";
        } else if (error.response.status === 415) {
          errorMessage = "Unsupported file type. Please use Excel or CSV.";
        }
      }

      setError(errorMessage);
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsUploading(false);
      // Reset progress after a delay
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const downloadTemplate = async (baseUrl: string, format: 'xlsx' | 'csv', type: string) => {
    try {
      const data = await downloadTemplateQuery({ baseUrl, format }).unwrap();

      const blob = new Blob([data]);
      const filename = `${type}_template.${format}`;

      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Download Started",
        description: `${type} template (${format}) download started`,
        variant: "success",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Unable to download template. Please check if the endpoint exists.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleDownloadTemplate = (type: "candidates" | "questions" | "ai") => {
    // Map the type to API endpoint base - these endpoints might need to be created in backend
    let baseUrl = "";
    if (type === "candidates") {
      baseUrl = "/candidates/import/template/";
    } else if (type === "questions") {
      baseUrl = "/questions/import/template/";
    } else if (type === "ai") {
      baseUrl = "/questions/import/template/";
    }

    toast({
      title: "Choose Format",
      description: `Select download format for ${type} template`,
      variant: "default",
      duration: 3000,
      action: (
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => downloadTemplate(baseUrl, 'xlsx', type)}
            className="px-3 py-1 bg-gradient-to-r from-brand-purple to-brand-violet text-white text-xs rounded-lg font-semibold shadow-sm transition-all hover:shadow-md hover:brightness-110"
          >
            Excel (.xlsx)
          </button>
          <button
            onClick={() => downloadTemplate(baseUrl, 'csv', type)}
            className="px-3 py-1 border border-slate-200 bg-white text-slate-700 text-xs rounded-lg font-semibold shadow-sm transition-colors hover:bg-slate-50"
          >
            CSV (.csv)
          </button>
        </div>
      ),
    });
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'xlsx':
        return <FileSpreadsheet className="w-6 h-6 text-green-600" />;
      case 'xls':
        return <FileSpreadsheet className="w-6 h-6 text-green-500" />;
      case 'csv':
        return <FileText className="w-6 h-6 text-blue-600" />;
      default:
        return <File className="w-6 h-6 text-slate-600" />;
    }
  };

  const SelectItem = React.forwardRef<HTMLDivElement, { children: React.ReactNode; value: string }>(
    ({ children, value, ...props }, forwardedRef) => {
      return (
        <Select.Item
          value={value}
          {...props}
          ref={forwardedRef}
          className="px-2.5 py-1.5 rounded-lg hover:bg-violet-50 cursor-pointer outline-none text-xs text-slate-700 data-[highlighted]:bg-violet-50 data-[state=checked]:font-semibold data-[state=checked]:text-brand-violet flex items-center gap-1"
        >
          <Select.ItemText>{children}</Select.ItemText>
        </Select.Item>
      );
    }
  );

  // Render guidelines based on current upload type
  const renderGuidelines = () => {
    const currentType = uploadType;

    switch (currentType) {
      case "candidate":
        return (
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
            <div className="flex items-center gap-1 text-blue-700 font-medium mb-1">
              <Users className="w-3 h-3" />
              <span className="text-xs">Candidates Upload</span>
            </div>
            <ul className="list-disc pl-4 text-xs space-y-0.5 text-slate-700">
              <li><strong>Required:</strong> username, email, first_name, phone</li>
              <li><strong>Optional:</strong> last_name</li>
              <li>Usernames auto-generated if not provided</li>
              <li>Passwords auto-generated</li>
              <li>Emails sent automatically if email provided</li>
            </ul>
          </div>
        );

      case "question":
        return (
          <div className="bg-green-50 border border-green-200 p-3 rounded-xl">
            <div className="flex items-center gap-1 text-green-700 font-medium mb-1">
              <FileText className="w-3 h-3" />
              <span className="text-xs">Questions Upload</span>
            </div>
            <ul className="list-disc pl-4 text-xs space-y-0.5 text-slate-700">
              <li><strong>Required:</strong> title, question_type, category, correct_answer</li>
              <li><strong>Optional:</strong> difficulty, marks, description, options, tags</li>
              <li>Supports: MCQ, Coding, SQL questions</li>
              <li>For coding questions: include coding_testcases as JSON array</li>
              <li>For SQL questions: include sql_dataset and sql_reference_solution</li>
            </ul>
          </div>
        );

      case "ai":
        return (
          <div className="bg-violet-50 border border-violet-200 p-3 rounded-xl">
            <div className="flex items-center gap-1 text-violet-700 font-medium mb-2">
              <Brain className="w-3 h-3" />
              <span className="text-xs">AI Questions Upload – CSV/Excel Guide</span>
            </div>

            {/* Required Columns */}
            <div className="mb-2">
              <p className="text-xs font-semibold text-slate-800 mb-1">
                Required Columns
              </p>
              <ul className="list-disc pl-4 text-xs space-y-0.5 text-slate-700">
                <li><strong>question</strong> (Required) – "What is REST API?"</li>
                <li><strong>complexity_level</strong> (Required) – "2-5_years"</li>
                <li><strong>profiles</strong> (Required) – "Backend Developer|Full Stack" (pipe separated)</li>
                <li><strong>is_active</strong> (Optional) – "true" or "false" (default: true)</li>
              </ul>
            </div>

            {/* Complexity Levels */}
            <div className="mb-2">
              <p className="text-xs font-semibold text-slate-800 mb-1">
                Complexity Levels
              </p>
              <ul className="list-disc pl-4 text-xs space-y-0.5 text-slate-700">
                <li>fresher – Fresher / Entry-level</li>
                <li>0-2_years – 0–2 years experience</li>
                <li>2-5_years – 2–5 years experience</li>
                <li>5-8_years – 5–8 years experience</li>
                <li>8+_years – 8+ years experience</li>
              </ul>
            </div>

            {/* Example CSV */}
            <div className="mb-2">
              <p className="text-xs font-semibold text-slate-800 mb-1">
                Example Format
              </p>
              <pre className="bg-white border border-slate-200 text-[10px] p-2 rounded-xl overflow-x-auto text-slate-700">
                {`question,complexity_level,profiles,is_active
"What is REST API?","2-5_years","Backend Developer","true"
"Explain microservices","2-5_years","Backend Developer|Full Stack Developer","true"
"Design a scalable system","5-8_years","Backend Developer","true"`}
              </pre>
            </div>

            {/* Features */}
            <div>
              <p className="text-xs font-semibold text-slate-800 mb-1">
                Features
              </p>
              <ul className="list-disc pl-4 text-xs space-y-0.5 text-slate-700">
                <li>Auto-creates missing profiles</li>
                <li>Skips duplicate questions</li>
                <li>Handles errors gracefully</li>
                <li>Supports both CSV and Excel formats</li>
              </ul>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <div className="flex items-center gap-1 text-slate-700 font-medium mb-1">
              <Info className="w-3 h-3" />
              <span className="text-xs">Select an upload type to see guidelines</span>
            </div>
          </div>
        );
    }
  };

  // Function to handle upload type change that also updates the tab
  const handleUploadTypeChange = (value: string) => {
    setUploadType(value);

    // Update the selected tab based on upload type
    if (value === "candidate") {
      setSelectedTab("candidates");
    } else if (value === "question") {
      setSelectedTab("questions");
    } else if (value === "ai") {
      setSelectedTab("ai");
    }

    // Clear any selected file when type changes
    setSelectedFile(null);
    setError("");
  };

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mx-auto max-w-[1600px]">
          {/* Header */}
          <PageHeader
            icon={UploadCloud}
            title="Import"
            description="Import candidates or questions in bulk from a file"
            className="mb-6"
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                <div className="p-4">
                  <h2 className={`${SECTION_TITLE} mb-4`}>Upload File</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium mb-2 text-slate-700">
                        Upload Type <span className="text-red-500">*</span>
                      </label>
                      <Select.Root
                        value={uploadType}
                        onValueChange={handleUploadTypeChange}
                      >
                        <Select.Trigger className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40">
                          <Select.Value placeholder="Select upload type">
                            {uploadType === "candidate" ? "Candidates" :
                              uploadType === "ai" ? "AI Questions" :
                                uploadType === "question" ? "Questions" : "Select type"}
                          </Select.Value>
                          <Select.Icon>
                            <ChevronDown className="w-3 h-3 text-slate-500" />
                          </Select.Icon>
                        </Select.Trigger>
                        <Select.Portal>
                          <Select.Content className="bg-white border border-slate-200/80 rounded-xl shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-black/5 p-1.5 min-w-[160px] z-50">
                            <Select.ScrollUpButton>
                              <ChevronUp className="w-3 h-3" />
                            </Select.ScrollUpButton>
                            <Select.Viewport>
                              <SelectItem value="candidate">
                                <div className="flex items-center gap-2">
                                  <Users className="w-3 h-3" />
                                  <span>Candidates</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="question">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-3 h-3" />
                                  <span>Questions</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="ai">
                                <div className="flex items-center gap-2">
                                  <Brain className="w-3 h-3 text-violet-600" />
                                  <span>AI Questions</span>
                                </div>
                              </SelectItem>
                            </Select.Viewport>
                            <Select.ScrollDownButton>
                              <ChevronDown className="w-3 h-3" />
                            </Select.ScrollDownButton>
                          </Select.Content>
                        </Select.Portal>
                      </Select.Root>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-2 text-slate-700">
                        Select File <span className="text-red-500">*</span>
                      </label>

                      {/* Drag & Drop Area */}
                      <div
                        className={`border-2 border-dashed rounded-xl p-3 text-center transition-all duration-200 cursor-pointer ${isDragging
                          ? 'border-brand-violet bg-violet-50'
                          : selectedFile
                            ? 'border-green-400 bg-green-50'
                            : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                          }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                        />

                        {selectedFile ? (
                          <div className="flex flex-col items-center">
                            <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                            <div className="flex items-center gap-2 mb-1">
                              {getFileIcon(selectedFile.name)}
                              <div className="text-left">
                                <p className="font-medium text-slate-800 text-xs">{selectedFile.name}</p>
                                <p className="text-xs text-slate-600">
                                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-slate-600 mb-2">File selected and ready to upload</p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFile(null);
                                setError("");
                              }}
                              className="flex items-center gap-0.5 px-2 py-0.5 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 text-xs"
                            >
                              <X className="w-3 h-3" />
                              Remove File
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <CloudUpload className="w-8 h-8 text-slate-400 mb-2" />
                            <p className="font-medium text-slate-700 text-xs mb-0.5">Drag & drop your file here</p>
                            <p className="text-xs text-slate-600 mb-2">or click to browse files</p>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <FileSpreadsheet className="w-3 h-3" />
                              <span>Excel (.xlsx, .xls) or CSV (.csv)</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {error && (
                        <div className="flex items-center gap-1 text-red-500 text-xs mt-2 p-2 bg-red-50 rounded-lg">
                          <AlertTriangle className="w-3 h-3" />
                          {error}
                        </div>
                      )}

                      {isUploading && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-slate-600 mb-1">
                            <span>Uploading...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5">
                            <div
                              className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleUpload}
                      disabled={!selectedFile || isUploading}
                      className={`flex items-center justify-center gap-1 w-full px-2 py-2 rounded-xl transition-all duration-200 text-xs font-semibold ${selectedFile && !isUploading
                        ? 'bg-gradient-to-r from-brand-purple to-brand-violet text-white shadow-sm hover:shadow-md hover:brightness-110'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                      {isUploading ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Uploading... ({uploadProgress}%)
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-3 h-3" />
                          Start Upload
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="space-y-4">
                {/* Upload Guidelines */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                  <div className="p-4">
                    <h2 className={`${SUBSECTION_TITLE} mb-3 flex items-center gap-1`}>
                      <Info className="w-3 h-3 text-blue-600" />
                      Upload Guidelines
                    </h2>

                    <div className="space-y-3">
                      {renderGuidelines()}
                    </div>
                  </div>
                </div>

                {/* Download Templates - Show relevant templates based on current type */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                  <div className="p-4">
                    <h2 className={`${SUBSECTION_TITLE} mb-3 flex items-center gap-1`}>
                      <Download className="w-3 h-3 text-green-600" />
                      Download Templates
                    </h2>

                    <div className="space-y-2">
                      {/* Show all templates or just the relevant one based on current type */}
                      {uploadType === "candidate" && (
                        <button
                          onClick={() => handleDownloadTemplate("candidates")}
                          className="flex items-center gap-2 w-full p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200 text-slate-700 text-xs group"
                        >
                          <div className="bg-blue-100 p-1 rounded-lg">
                            <Users className="w-3 h-3 text-blue-600" />
                          </div>
                          <div className="text-left flex-1">
                            <p className="font-medium text-xs">Candidates Template</p>
                            <p className="text-xs text-slate-500">Excel & CSV format</p>
                          </div>
                          <Download className="w-3 h-3 text-slate-400 group-hover:text-brand-violet transition-colors" />
                        </button>
                      )}

                      {uploadType === "question" && (
                        <button
                          onClick={() => handleDownloadTemplate("questions")}
                          className="flex items-center gap-2 w-full p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200 text-slate-700 text-xs group"
                        >
                          <div className="bg-green-100 p-1 rounded-lg">
                            <FileText className="w-3 h-3 text-green-600" />
                          </div>
                          <div className="text-left flex-1">
                            <p className="font-medium text-xs">Questions Template</p>
                            <p className="text-xs text-slate-500">Excel & CSV format</p>
                          </div>
                          <Download className="w-3 h-3 text-slate-400 group-hover:text-green-600 transition-colors" />
                        </button>
                      )}

                      {uploadType === "ai" && (
                        <button
                          onClick={() => handleDownloadTemplate("ai")}
                          className="flex items-center gap-2 w-full p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200 text-slate-700 text-xs group"
                        >
                          <div className="bg-violet-100 p-1 rounded-lg">
                            <Brain className="w-3 h-3 text-violet-600" />
                          </div>
                          <div className="text-left flex-1">
                            <p className="font-medium text-xs">AI Questions Template</p>
                            <p className="text-xs text-slate-500">Excel & CSV format</p>
                          </div>
                          <Download className="w-3 h-3 text-slate-400 group-hover:text-violet-600 transition-colors" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Tips */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <div className="flex items-center gap-1 text-amber-700 font-medium mb-2">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="text-xs">Pro Tips</span>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-700">
                    <li className="flex items-start gap-1">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Keep file size under 10MB for faster processing</span>
                    </li>
                    <li className="flex items-start gap-1">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Use the templates to ensure proper formatting</span>
                    </li>
                    <li className="flex items-start gap-1">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Backup data before bulk operations</span>
                    </li>
                    <li className="flex items-start gap-1">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Ensure all required columns are present</span>
                    </li>
                    <li className="flex items-start gap-1">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Remove duplicates before uploading</span>
                    </li>
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
