import React, { useState, useRef, useEffect } from "react";
import { Video, CheckCircle, Clock, Sparkles, AlertCircle, Loader2, ArrowLeft, ChevronDown } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useLazyGetAiIntroductionQuery, useGetPresignedUrlIntroMutation, useUploadIntroductionVideoMutation, usePrepareQuestionsAsyncMutation, useGetProfileQuery } from "@/store";
import { useToast } from "@/hooks/use-toast";
import { formatDateValue } from "@/utils/commonFunctions";
import { AI_EXPERIENCE_TO_LABEL_MAP, AI_ROLE_TO_LABEL_MAP } from "@/constants/roleMappings";
import VoiceLevelAnalyzer from '@/components/VoiceLevelAnalyzer';
const RecordIntroduction: React.FC = () => {
    const [alreadyRecorded, setAlreadyRecorded] = useState<boolean>(false);
    const { data: profileData } = useGetProfileQuery();
    const candidateFirstName = profileData?.first_name || '';
    const candidateInitial = (profileData?.first_name?.[0] || profileData?.email?.[0] || 'C').toUpperCase();
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [recordingTime, setRecordingTime] = useState<number>(0);
    const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
    // Mic toggle was removed during the design refresh; mic is always on for
    // the introduction recording flow. Kept as a const so the rest of the
    // file's `isMicActive` reads continue to compile.
    const isMicActive = true;
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<string>("");
    const [apiData, setApiData] = useState<ApiResponse | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    // Object URL for the recorded-video preview. Kept in state (not just on the
    // ref) because the preview <video> only mounts after isVideoRecorded flips
    // true — setting previewRef.current.src inside onstop ran before that
    // element existed, so the preview stayed blank.
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isVideoRecorded, setIsVideoRecorded] = useState<boolean>(false);
    const [recordingTooShort, setRecordingTooShort] = useState<boolean>(false);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    // Background upload status. The S3 upload now kicks off automatically the
    // moment recording stops (see onstop) so the video is already on S3 before
    // the candidate hits "Submit & continue" — submit then just awaits / reuses
    // this result instead of starting the upload from scratch.
    const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
    // Holds the in-flight (or settled) background upload promise so handleSubmit
    // can await it rather than re-uploading. Reset on re-record.
    const uploadPromiseRef = useRef<Promise<boolean> | null>(null);
    // Voice check now runs BEFORE the recording screen. The candidate does the
    // mic test first; only once it's done (passed or skipped) do we reveal the
    // introduction recording page.
    const [voiceCheckDone, setVoiceCheckDone] = useState<boolean>(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const previewRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<number | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    // Track the recording duration at the moment stop was requested to avoid stale closure values
    const stopRequestedTimeRef = useRef<number | null>(null);

    const { id } = useParams<{ id: string }>();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [getAiIntroduction] = useLazyGetAiIntroductionQuery();
    const [getPresignedUrlIntro] = useGetPresignedUrlIntroMutation();
    const [uploadIntroductionVideo] = useUploadIntroductionVideoMutation();
    const [prepareQuestionsAsync] = usePrepareQuestionsAsyncMutation();

    interface AssessmentDetails {
        id: number;
        created_by_username: string;
        title: string;
        description: string;
        role_type: string;
        experience_level: string;
        start_date: string;
        end_date: string;
        instructions: string;
        num_questions: number;
        num_hardcoded_questions: number;
        gemini_api_key: string;
        enable_voice_recording: boolean;
        enable_camera: boolean;
        is_active: boolean;
        created_at: string;
        updated_at: string;
        created_by: number;
    }

    interface ApiResponse {
        status: string;
        assessment: AssessmentDetails;
    }

    interface PresignedUrlResponse {
        url: string;
        fields: {
            key: string;
            "Content-Type"?: string;
            policy: string;
            "x-amz-algorithm"?: string;
            "x-amz-credential"?: string;
            "x-amz-date"?: string;
            "x-amz-signature"?: string;
            signature?: string;
            [key: string]: string | undefined;
        };
        file_key?: string;
        s3_url: string;
    }

    useEffect(() => {
        const initializeCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: 'user'
                    },
                    audio: true
                });
                setCameraStream(stream);
                setIsCameraActive(true);
                setCameraError("");

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err: any) {
                console.error("Error accessing camera:", err);
                setCameraError(err.message || "Unable to access camera");
                setIsCameraActive(false);

                if (videoRef.current) {
                    videoRef.current.srcObject = null;
                }
            }
        };

        initializeCamera();

        return () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    // Re-bind the live camera stream whenever the <video> element re-mounts
    // (the page swaps between the already-recorded gate, the intro page, and
    // the recorded-preview branch, which re-creates the <video> node and
    // leaves the new one without srcObject).
    useEffect(() => {
        const v = videoRef.current;
        if (v && cameraStream && !isVideoRecorded && v.srcObject !== cameraStream) {
            v.srcObject = cameraStream;
            v.play?.().catch(() => {});
        }
    }, [cameraStream, alreadyRecorded, voiceCheckDone, isVideoRecorded, isCameraActive]);

    useEffect(() => {
        const fetchAssessmentDetails = async () => {
            try {
                const data = await getAiIntroduction(Number(id)).unwrap();
                setApiData(data);
                if (data.status === "recorded") {
                    // Don't silently redirect — surface a gate so the candidate
                    // always sees the introduction screen and chooses to continue.
                    setAlreadyRecorded(true);
                }
            } catch (error) {
                console.error("Error fetching assessment details:", error);
                toast({
                    title: "Error",
                    description: "Failed to load assessment details",
                    variant: "destructive",
                    duration: 3000
                });
            }
        };

        if (id) {
            fetchAssessmentDetails();
        }
    }, [id, toast]);

    // Handle recording timer
    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= 300) { // 5 minutes max
                        stopRecording();
                        return 300;
                    }
                    return prev + 1;
                });
            }, 1000);
        } else if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isRecording]);

    const formatRoleType = (roleType: string) => {
        return AI_ROLE_TO_LABEL_MAP[roleType] || roleType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const formatExperienceLevel = (expLevel: string) => {
        return AI_EXPERIENCE_TO_LABEL_MAP[expLevel] || expLevel.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const formatDate = (dateString: string) =>
        formatDateValue(dateString, { year: "numeric", month: "short", day: "numeric" }, dateString);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

const triggerEarlyQuestionGeneration = async () => {
  try {
    await prepareQuestionsAsync(Number(id)).unwrap();
  } catch (err) {
    console.error('Trigger failed (silent):', err);
  }
};
    const startRecording = () => {
        if (!cameraStream || !isCameraActive) {
            toast({
                title: "Error",
                description: "Camera is not available",
                variant: "destructive",
                duration: 3000
            });
            return;
        }

        // Clear prior chunks and stop time ref
        chunksRef.current = [];
        stopRequestedTimeRef.current = null;
        triggerEarlyQuestionGeneration();

        try {
            const mediaRecorder = new MediaRecorder(cameraStream, {
                mimeType: 'video/webm;codecs=vp9,opus'
            });

            mediaRecorderRef.current = mediaRecorder;
            setRecordingTooShort(false);

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            // Use stopRequestedTimeRef (set by stopRecording) to determine final duration
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'video/webm' });

                const durationAtStop = stopRequestedTimeRef.current ?? recordingTime;

                // If recording is too short, show error and an overlay prompting re-record
                if (durationAtStop < 30) {
                    // Discard short recording data
                    chunksRef.current = [];
                    setRecordedBlob(null);
                    setIsVideoRecorded(false);
                    setRecordingTooShort(true);
                    toast({
                        title: "Recording Too Short",
                        description: "Please record an introduction video longer than 30 seconds.",
                        variant: "destructive",
                        duration: 4000
                    });
                    stopRequestedTimeRef.current = null;
                    return;
                }

                stopRequestedTimeRef.current = null;
                setRecordingTooShort(false);
                setRecordedBlob(blob);
                setIsVideoRecorded(true);

                // Bind the preview via state — the preview <video> mounts only
                // after isVideoRecorded flips true, so a ref assignment here
                // would target a not-yet-rendered element and stay blank.
                setPreviewUrl(URL.createObjectURL(blob));

                // Start uploading to S3 immediately — by the time the candidate
                // reviews the preview and hits "Submit & continue" the video is
                // already on S3, so the assessment starts without waiting.
                startBackgroundUpload(blob);

                toast({
                    title: "Success",
                    description: "Recording completed successfully",
                    variant: "success",
                    duration: 3000
                });
            };

            mediaRecorder.start(1000); // Collect data every second
            setIsRecording(true);
            setRecordingTime(0);

            toast({
                title: "Recording Started",
                description: "Your introduction video is now being recorded",
                variant: "success",
                duration: 2000
            });

        } catch (error) {
            console.error("Error starting recording:", error);
            toast({
                title: "Recording Error",
                description: "Failed to start recording. Please try again.",
                variant: "destructive",
                duration: 3000
            });
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            // Save the current duration so onstop handler can use an accurate value
            stopRequestedTimeRef.current = recordingTime;

            mediaRecorderRef.current.stop();
            setIsRecording(false);

            // Stop all tracks
            cameraStream?.getTracks().forEach(track => track.stop());
            setCameraStream(null);
            // Hide camera UI after stopping; will be re-enabled on retry
            setIsCameraActive(false);
        }
    };
    
    const retryCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            setCameraStream(stream);
            setIsCameraActive(true);
            setCameraError("");

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err: any) {
            setCameraError(err.message || "Unable to access camera");
            setIsCameraActive(false);
        }
    };

    const getPresignedUrl = async (): Promise<PresignedUrlResponse | null> => {
        try {
            const formData = new FormData();
            formData.append("ai_assessment_id", id || "");
            formData.append("file_name", "introduction.webm");
            formData.append("file_type", "video/webm");

            const data = await getPresignedUrlIntro(formData).unwrap();

            return data;
        } catch (error: any) {
            toast({
                title: "Upload Error",
                description: "Failed to get upload URL",
                variant: "destructive",
            });
            return null;
        }
    };


    const uploadToS3 = async (
        presignedData: PresignedUrlResponse,
        blob: Blob,
    ): Promise<boolean> => {
        if (!blob) {
            toast({
                title: "Error",
                description: "No video to upload",
                variant: "destructive",
            });
            return false;
        }

        try {
            const s3FormData = new FormData();
            Object.entries(presignedData.fields).forEach(([key, value]) => {
                if (value) {
                    s3FormData.append(key, value);
                }
            });
            const file = new File(
                [blob],
                "introduction.webm",
                { type: "video/webm" }
            );
            s3FormData.append("file", file);
            const success = await new Promise<boolean>((resolve) => {
                const xhr = new XMLHttpRequest();
                xhr.open("POST", presignedData.url);
            
                // Upload Progress
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percent = Math.round((event.loaded * 100) / event.total);
                        setUploadProgress(percent);
                    }
                };

                xhr.onload = () => {
                    resolve(xhr.status >= 200 && xhr.status < 300);
                };

                xhr.onerror = () => resolve(false);

                xhr.send(s3FormData);
            });

            if (!success) {
                throw new Error("S3 upload failed");
            }

            return true;
        } catch (error) {
            toast({
                title: "Upload Error",
                description: "Failed to upload video to S3",
                variant: "destructive",
            });
            return false;
        }
    };

    const saveVideoUrl = async (s3Url: string): Promise<boolean> => {
        try {
            const payload = {
                ai_assessment_id: id,
                s3_url: s3Url,
            };

            const data = await uploadIntroductionVideo({
                url: "/ai-assessment/upload-introduction-video/",
                data: payload,
            }).unwrap();

            return data?.status === "success";
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to save video",
                variant: "destructive",
            });
            return false;
        }
    };


    const uploadDirectToBackend = async (blob: Blob): Promise<boolean> => {
        if (!blob) return false;
        try {
            const formData = new FormData();
            formData.append("ai_assessment_id", id || "");
            formData.append("video_file", new File([blob], "introduction.webm", { type: "video/webm" }));

            const data = await uploadIntroductionVideo({
                url: "/ai-assessment/upload-introduction-video/",
                data: formData,
                headers: { "Content-Type": "multipart/form-data" },
            }).unwrap();
            return data?.status === "success";
        } catch (error) {
            console.error("Direct upload failed:", error);
            return false;
        }
    };

    // Full upload pipeline for one recorded blob: S3 presigned flow first, then
    // a direct-to-backend fallback. Returns true once the intro is persisted.
    const performUpload = async (blob: Blob): Promise<boolean> => {
        let success = false;

        // Try S3 presigned URL flow first
        const presignedData = await getPresignedUrl();
        if (presignedData) {
            const uploaded = await uploadToS3(presignedData, blob);
            if (uploaded) {
                success = await saveVideoUrl(presignedData.s3_url);
            }
        }

        // Fall back to direct file upload if S3 flow failed
        if (!success) {
            success = await uploadDirectToBackend(blob);
        }

        return success;
    };

    // Kick the upload off in the background (called from onstop the instant a
    // valid recording finishes). The promise is stashed on uploadPromiseRef so
    // handleSubmit can await the already-running upload instead of restarting it.
    const startBackgroundUpload = (blob: Blob): Promise<boolean> => {
        setUploadState('uploading');
        setUploadProgress(0);
        const p = performUpload(blob)
            .then((ok) => {
                setUploadState(ok ? 'done' : 'error');
                return ok;
            })
            .catch((err) => {
                console.error('Background intro upload failed:', err);
                setUploadState('error');
                return false;
            });
        uploadPromiseRef.current = p;
        return p;
    };

    const handleSubmit = async () => {
        if (!recordedBlob) {
            toast({
                title: "No Video",
                description: "Please record a video first",
                variant: "destructive",
            });
            return;
        }

        if (recordingTime < 30) {
            toast({
                title: "Too Short",
                description: "Please record an introduction video longer than 30 seconds.",
                variant: "destructive",
            });
            return;
        }

        setIsUploading(true);

        // Tear down the camera + recorded preview the moment the candidate
        // submits. The recorded blob is already captured for upload, so we no
        // longer need the live stream or the on-screen video window — the
        // full-screen uploading state takes over. (recordedBlob is kept so the
        // upload, and a retry on failure, still work.)
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setIsCameraActive(false);
        if (previewRef.current) {
            try { previewRef.current.pause(); } catch (e) { /* ignore */ }
        }

        try {
            // The upload already started the moment recording stopped. Reuse it:
            // - 'done'      → nothing to wait for, continue straight to the assessment
            // - 'uploading' → await the in-flight upload
            // - else        → start (or retry) the upload now
            let success = false;
            if (uploadState === 'done') {
                success = true;
            } else if (uploadPromiseRef.current) {
                success = await uploadPromiseRef.current;
            }
            if (!success) {
                success = await startBackgroundUpload(recordedBlob);
            }

            if (!success) {
                toast({
                    title: "Upload Failed",
                    description: "Failed to upload introduction video. Please try again.",
                    variant: "destructive",
                });
                return;
            }

            toast({
                title: "Success",
                description: "Introduction video uploaded successfully",
                variant: "success",
            });

            // Release the recorded preview's object URL before leaving the page.
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
            }

            navigate(`/candidate/ai-assessment/${id}/running`);
        } finally {
            setIsUploading(false);
        }
    };


    const retryRecording = () => {
        setRecordedBlob(null);
        setIsVideoRecorded(false);
        setRecordingTime(0);
        setUploadProgress(0);
        setRecordingTooShort(false);

        // Discard the previous recording's background upload — the next
        // recording starts a fresh one when it stops.
        setUploadState('idle');
        uploadPromiseRef.current = null;

        // Release the previous preview URL and clear it.
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);

        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }
        const initializeCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: 'user'
                    },
                    audio: true
                });
                setCameraStream(stream);
                setIsCameraActive(true);
                setCameraError("");

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err: any) {
                setCameraError(err.message || "Unable to access camera");
                setIsCameraActive(false);
            }
        };

        initializeCamera();
    };

    return (
        // Outer wrapper was h-screen + overflow-hidden — that pinned the
        // page to viewport height and clipped Start / Stop recording
        // buttons on shorter screens (and blocked the page from
        // scrolling so the candidate couldn't reach them). Switch to
        // min-h-screen and let the page scroll naturally; the aurora
        // orbs are now fixed-position so they stay anchored to the
        // viewport regardless of how long the content gets.
        <div className="relative min-h-screen text-slate-900 bg-[radial-gradient(120%_60%_at_50%_-10%,rgba(124,58,237,0.10)_0%,rgba(124,58,237,0)_60%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
            {/* Aurora orbs — fixed to viewport, never compete with content height */}
            <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden -z-0">
                <div className="absolute -left-32 top-24 h-80 w-80 rounded-full bg-brand-violet/12 blur-3xl" />
                <div className="absolute -right-32 top-40 h-96 w-96 rounded-full bg-brand-purple/12 blur-3xl" />
                <div className="absolute -bottom-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-violet/10 blur-3xl" />
            </div>

            {/* Watermark (decorative, bottom-right) */}
            <div aria-hidden className="pointer-events-none absolute right-8 bottom-6 z-0 flex items-center gap-2 opacity-[0.07]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white">
                    <img src="/SkilTechyFavicon.png" alt="" className="h-6 w-6" />
                </span>
                <span className="text-xl font-bold tracking-tight text-brand-purple">SkilTechy</span>
            </div>

            {/* Floating top bar — logo (left) + identity + back (right) */}
            <div className="pointer-events-none absolute left-5 top-4 z-30 flex items-center gap-2">
                <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet text-white shadow-[0_8px_22px_-6px_rgba(124,58,237,0.55)] ring-1 ring-white/20">
                    <img src="/SkilTechyFavicon.png" alt="" className="h-5 w-5" />
                    <span aria-hidden className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/0 via-white/25 to-white/0" />
                </span>
                <span className="hidden rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-violet ring-1 ring-inset ring-violet-200/80 backdrop-blur-xl sm:inline-flex">
                    AI Assessment
                </span>
            </div>

            <div className="pointer-events-auto absolute right-5 top-4 z-30 flex items-center gap-2">
                <div className="hidden items-center gap-2 rounded-full border border-slate-200/60 bg-white/75 py-1 pl-1 pr-3 shadow-[0_8px_24px_-12px_rgba(61,7,95,0.30)] backdrop-blur-xl backdrop-saturate-150 sm:inline-flex">
                    <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet text-[11px] font-bold text-white shadow-[0_4px_12px_-2px_rgba(124,58,237,0.45)] ring-1 ring-white/20">
                        {candidateInitial}
                        <span aria-hidden className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/0 via-white/20 to-white/0" />
                    </span>
                    <span className="max-w-[140px] truncate text-xs font-semibold text-slate-700">{candidateFirstName || 'Candidate'}</span>
                </div>
                <button
                    type="button"
                    onClick={() => navigate('/candidate/dashboard')}
                    title="Back to dashboard"
                    className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-white/75 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-[0_8px_24px_-12px_rgba(61,7,95,0.30)] backdrop-blur-xl backdrop-saturate-150 transition-all duration-200 hover:-translate-y-0.5 hover:text-brand-violet hover:shadow-md active:translate-y-0"
                >
                    <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
                    Back
                </button>
            </div>

            {/* Already-recorded gate */}
            {alreadyRecorded && (
                <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-6 py-10">
                    <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/60 bg-white/85 p-8 text-center shadow-[0_24px_60px_-18px_rgba(61,7,95,0.40)] backdrop-blur-xl">
                        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-violet/12 blur-3xl" />
                        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple" />

                        <span className="relative mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_8px_22px_-6px_rgba(16,185,129,0.55)] ring-1 ring-white/20">
                            <CheckCircle className="h-7 w-7" />
                        </span>

                        <h2 className="relative text-xl font-bold tracking-tight text-slate-900">
                            Introduction already recorded
                        </h2>
                        <p className="relative mt-1.5 text-sm leading-relaxed text-slate-600">
                            {apiData?.assessment?.title
                                ? `Your introduction for "${apiData.assessment.title}" is on file.`
                                : "Your introduction is on file."}
                        </p>

                        <div className="relative mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                            <button
                                type="button"
                                onClick={() => navigate(`/candidate/ai-assessment/${id}/running`)}
                                className="group inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_22px_-6px_rgba(124,58,237,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-6px_rgba(124,58,237,0.65)] active:translate-y-0"
                            >
                                <Sparkles className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                                Continue to interview
                            </button>
                            <button
                                type="button"
                                onClick={() => setAlreadyRecorded(false)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-violet/40 hover:text-brand-violet hover:shadow-md active:translate-y-0"
                            >
                                Re-record introduction
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Introduction Recording Page — only after the voice check */}
        {!alreadyRecorded && voiceCheckDone && !isUploading && (
            <div className="relative min-h-[calc(100vh-4rem)] text-slate-900 bg-[radial-gradient(120%_60%_at_50%_-10%,rgba(124,58,237,0.10)_0%,rgba(124,58,237,0)_60%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
                {/* Decorative aurora orbs */}
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] overflow-hidden">
                    <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-brand-violet/15 blur-3xl" />
                    <div className="absolute -right-24 top-24 h-80 w-80 rounded-full bg-brand-purple/15 blur-3xl" />
                </div>

                <div className="relative z-10 mx-auto max-w-[1280px] px-5 py-6">
                    {/* Page Header */}
                    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                        <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-violet">
                                <Sparkles className="h-3 w-3" />
                                Introduction
                            </p>
                            <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                                {apiData?.assessment?.title || "Record your introduction"}
                            </h1>
                            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
                                {apiData?.assessment?.description ||
                                    "Record a short introduction video before starting the assessment."}
                            </p>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-purple/10 via-brand-violet/10 to-brand-purple/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-violet ring-1 ring-inset ring-brand-violet/20">
                            Step 2 of 2
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                        {/* `flex flex-col` (not space-y) so the order utilities below can
                            reorder children on mobile — video + controls go first, tips
                            collapsible drops below. On lg the original visual order is
                            restored. */}
                        <div className="flex flex-col gap-5 lg:col-span-8">

                            {/* "Before you begin" card — collapsible on mobile so the
                                video + recording controls remain above the fold; on lg
                                it appears above the video in the original visual order. */}
                            <details open className="group/tips order-2 lg:order-none relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/85 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_36px_-20px_rgba(61,7,95,0.28)] backdrop-blur-xl">
                                <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-violet/30 to-transparent" />
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4 [&::-webkit-details-marker]:hidden">
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-[0_4px_12px_-2px_rgba(124,58,237,0.45)] ring-1 ring-white/20">
                                            <AlertCircle className="h-3.5 w-3.5" />
                                        </span>
                                        <h4 className="text-sm font-bold tracking-tight text-slate-900">Before you begin</h4>
                                    </div>
                                    <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200 group-open/tips:rotate-180" />
                                </summary>
                                <ul className="grid grid-cols-1 gap-1.5 px-5 pb-5 text-[13px] leading-relaxed text-slate-600 sm:grid-cols-2">
                                    {[
                                        "Your full name",
                                        "Your current role or position",
                                        "Your relevant experience or background",
                                        "Your current company or organization",
                                        "Your expectations from this interview",
                                    ].map((item) => (
                                        <li key={item} className="group/item flex items-start gap-2 transition-colors duration-200 hover:text-slate-900">
                                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300 transition-colors duration-200 group-hover/item:bg-brand-violet" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </details>

                            {/* Video card */}
                            <div className="order-1 lg:order-none relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/85 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_44px_-24px_rgba(61,7,95,0.32)] backdrop-blur-xl sm:p-6">
                                <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-violet/30 to-transparent" />
                                <span aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-violet/10 blur-3xl" />

                                {/* Video preview */}
                                <div className="flex justify-center">
                                    <div className={`relative aspect-video w-full max-w-[560px] overflow-hidden rounded-2xl bg-slate-900 shadow-[0_18px_38px_-22px_rgba(61,7,95,0.55)] ring-1 ring-white/10 ${isRecording ? 'ring-2 ring-rose-500/70' : ''}`}>
                                        {isVideoRecorded && recordedBlob ? (
                                            <video
                                                ref={previewRef}
                                                src={previewUrl ?? undefined}
                                                controls
                                                playsInline
                                                className="h-full w-full object-contain bg-slate-900"
                                            />
                                        ) : (
                                            <video
                                                ref={videoRef}
                                                autoPlay
                                                muted
                                                playsInline
                                                className="h-full w-full object-cover"
                                            />
                                        )}

                                        {/* Camera Error */}
                                        {cameraError && !isVideoRecorded && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-6 text-center backdrop-blur-sm">
                                                <AlertCircle className="mb-3 h-12 w-12 text-rose-400" />
                                                <p className="font-semibold text-white">Camera error</p>
                                                <p className="mb-4 mt-1 text-xs text-white/70">{cameraError}</p>
                                                <button
                                                    type="button"
                                                    onClick={retryCamera}
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                                                >
                                                    <Video className="h-3.5 w-3.5" /> Retry
                                                </button>
                                            </div>
                                        )}

                                        {/* Recording Too Short */}
                                        {recordingTooShort && !isRecording && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 p-6 text-center backdrop-blur-sm">
                                                <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-[0_8px_22px_-6px_rgba(245,158,11,0.55)] ring-1 ring-white/20">
                                                    <Sparkles className="h-6 w-6" />
                                                </span>
                                                <p className="font-semibold text-white">Recording too short</p>
                                                <p className="mb-4 mt-1 text-xs text-white/70">Please record at least 30 seconds.</p>
                                                <button
                                                    type="button"
                                                    onClick={retryRecording}
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                                                >
                                                    Re-record
                                                </button>
                                            </div>
                                        )}

                                        {/* Recording Badge */}
                                        {isRecording && (
                                            <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-rose-500/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white shadow-sm ring-1 ring-inset ring-white/30 backdrop-blur">
                                                <span className="relative flex h-1.5 w-1.5">
                                                    <span className="absolute inset-0 animate-ping rounded-full bg-white opacity-80" />
                                                    <span className="relative h-full w-full rounded-full bg-white" />
                                                </span>
                                                Recording
                                            </div>
                                        )}

                                        {/* Timer */}
                                        <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-950/70 px-2.5 py-1 text-xs font-bold tabular-nums text-white ring-1 ring-inset ring-white/15 backdrop-blur">
                                            <Clock className="h-3 w-3 text-white/70" />
                                            {formatTime(recordingTime)}
                                        </div>

                                        {/* Cinematic bottom overlay */}
                                        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent" />

                                        {/* Status row */}
                                        {!isVideoRecorded && (
                                            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/80">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span className={`h-1.5 w-1.5 rounded-full ${isCameraActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                                    Cam {isCameraActive ? 'on' : 'off'}
                                                </span>
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span className={`h-1.5 w-1.5 rounded-full ${isMicActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                                    Mic {isMicActive ? 'on' : 'off'}
                                                </span>
                                                <span className="text-white/60">720p · 30fps</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Controls */}
                                {!isVideoRecorded ? (
                                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                                        <button
                                            type="button"
                                            onClick={startRecording}
                                            disabled={isRecording || !isCameraActive}
                                            className="group inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_28px_-6px_rgba(124,58,237,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-6px_rgba(124,58,237,0.65)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_10px_28px_-6px_rgba(124,58,237,0.30)]"
                                        >
                                            <Video className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                                            Start recording
                                        </button>
                                        <button
                                            type="button"
                                            onClick={stopRecording}
                                            disabled={!isRecording}
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-5 py-2.5 text-sm font-semibold text-rose-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-50 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                                        >
                                            <span className="h-2 w-2 rounded-sm bg-rose-500" />
                                            Stop
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                                        <button
                                            type="button"
                                            onClick={retryRecording}
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-violet/40 hover:text-brand-violet hover:shadow-md active:translate-y-0"
                                        >
                                            Re-record
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSubmit}
                                            disabled={isUploading}
                                            className="group inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_28px_-6px_rgba(124,58,237,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-6px_rgba(124,58,237,0.65)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <CheckCircle className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                                            Submit &amp; continue
                                        </button>
                                    </div>
                                )}

                                {/* Background upload status — the video starts
                                    uploading to S3 the moment recording stops. */}
                                {isVideoRecorded && !isUploading && uploadState !== 'idle' && (
                                    <div className="mt-3 flex justify-center">
                                        {uploadState === 'uploading' ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-violet-50 to-violet-100/70 px-3 py-1.5 text-xs font-semibold text-brand-violet ring-1 ring-inset ring-violet-200">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Uploading your video{uploadProgress > 0 ? ` ${uploadProgress}%` : '…'}
                                            </span>
                                        ) : uploadState === 'done' ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100/70 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                                <CheckCircle className="h-3 w-3" />
                                                Video uploaded — ready to continue
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-amber-50 to-amber-100/70 px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                                                <AlertCircle className="h-3 w-3" />
                                                Upload didn’t finish — we’ll retry when you submit
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Time info chip */}
                                <div className="mt-5 flex justify-center">
                                    {recordingTime < 30 ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-rose-50 to-rose-100/70 px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                                            <Clock className="h-3 w-3" />
                                            {30 - recordingTime}s more to reach minimum (30s)
                                        </span>
                                    ) : recordingTime <= 300 ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100/70 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                                            <CheckCircle className="h-3 w-3" />
                                            {300 - recordingTime}s remaining
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-rose-50 to-rose-100/70 px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                                            <AlertCircle className="h-3 w-3" />
                                            Time limit exceeded
                                        </span>
                                    )}
                                </div>

                                {/* Upload progress */}
                                {isUploading && uploadProgress > 0 && (
                                    <div className="mt-4 space-y-1.5">
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
                                            <div className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-violet transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                        </div>
                                        <p className="text-center text-[11px] font-semibold text-slate-500">Uploading {uploadProgress}%</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT PANEL */}
                        <aside className="space-y-3 self-start lg:col-span-4 lg:sticky lg:top-6">
                            {/* Tips */}
                            <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/85 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_36px_-22px_rgba(61,7,95,0.24)] backdrop-blur-xl">
                                <div className="mb-3 flex items-center gap-2">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_4px_12px_-2px_rgba(16,185,129,0.45)] ring-1 ring-white/20">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                    </span>
                                    <h4 className="text-sm font-bold tracking-tight text-slate-900">Tips</h4>
                                </div>
                                <ul className="space-y-1.5 text-xs leading-relaxed text-slate-600">
                                    {[
                                        "Ensure good lighting",
                                        "Speak clearly",
                                        "Look at the camera",
                                        "Keep it professional",
                                        "Smile and relax",
                                    ].map((tip) => (
                                        <li key={tip} className="group/tip flex items-start gap-2 transition-colors duration-200 hover:text-slate-900">
                                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300 transition-colors duration-200 group-hover/tip:bg-emerald-500" />
                                            {tip}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Assessment Details */}
                            {apiData?.assessment && (
                                <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/85 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_36px_-22px_rgba(61,7,95,0.24)] backdrop-blur-xl">
                                    <div className="mb-3 flex items-center gap-2">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-[0_4px_12px_-2px_rgba(124,58,237,0.45)] ring-1 ring-white/20">
                                            <Sparkles className="h-3.5 w-3.5" />
                                        </span>
                                        <h4 className="text-sm font-bold tracking-tight text-slate-900">Assessment</h4>
                                    </div>
                                    <dl className="space-y-1.5 text-xs">
                                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                                            <dt className="text-slate-500">Role</dt>
                                            <dd className="font-semibold text-slate-800">{formatRoleType(apiData.assessment.role_type)}</dd>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                                            <dt className="text-slate-500">Experience</dt>
                                            <dd className="font-semibold text-slate-800">{formatExperienceLevel(apiData.assessment.experience_level)}</dd>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                                            <dt className="text-slate-500">Questions</dt>
                                            <dd className="font-semibold tabular-nums text-slate-800">{apiData.assessment.num_questions}</dd>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <dt className="text-slate-500">Valid until</dt>
                                            <dd className="font-semibold text-slate-800">{formatDate(apiData.assessment.end_date)}</dd>
                                        </div>
                                    </dl>
                                </div>
                            )}

                            {/* Guidelines */}
                            <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/85 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_36px_-22px_rgba(61,7,95,0.24)] backdrop-blur-xl">
                                <div className="mb-3 flex items-center gap-2">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-[0_4px_12px_-2px_rgba(245,158,11,0.45)] ring-1 ring-white/20">
                                        <Clock className="h-3.5 w-3.5" />
                                    </span>
                                    <h4 className="text-sm font-bold tracking-tight text-slate-900">Guidelines</h4>
                                </div>
                                <ul className="space-y-1.5 text-xs leading-relaxed text-slate-600">
                                    {[
                                        "Min 30 seconds, max 5 minutes",
                                        "Quiet environment",
                                        "Stable internet connection",
                                        "Face clearly visible to camera",
                                    ].map((g) => (
                                        <li key={g} className="group/g flex items-start gap-2 transition-colors duration-200 hover:text-slate-900">
                                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300 transition-colors duration-200 group-hover/g:bg-amber-500" />
                                            {g}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </aside>
                    </div>
                </div>
            </div>
            )}

            {/* Step 1: Voice Check Page — runs BEFORE recording */}
            {!alreadyRecorded && !voiceCheckDone && (
                <VoiceLevelAnalyzer
                    onComplete={(success) => {
                            setVoiceCheckDone(true);
                            toast({
                                title: success ? "Voice Check Passed" : "Voice Check Skipped",
                                description: success
                                    ? "Microphone is working — now record your introduction."
                                    : "Microphone may not work properly — you can still record your introduction.",
                                variant: success ? "success" : "warning",
                                duration: 4000
                            });
                        }}
                />
            )}

            {voiceCheckDone && isUploading && (
                <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 text-slate-900 bg-[radial-gradient(120%_60%_at_50%_-10%,rgba(124,58,237,0.10)_0%,rgba(124,58,237,0)_60%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
                    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-brand-violet/15 blur-3xl" />
                        <div className="absolute -right-24 bottom-1/4 h-72 w-72 rounded-full bg-brand-purple/15 blur-3xl" />
                    </div>

                    <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/60 bg-white/85 p-8 text-center shadow-[0_24px_60px_-18px_rgba(61,7,95,0.45)] backdrop-blur-xl">
                        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple" />
                        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-violet/12 blur-3xl" />

                        <span className="relative mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet text-white shadow-[0_10px_28px_-6px_rgba(124,58,237,0.55)] ring-1 ring-white/20">
                            <Loader2 className="h-7 w-7 animate-spin" />
                            <span aria-hidden className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/0 via-white/25 to-white/0" />
                        </span>

                        <h2 className="relative text-xl font-bold tracking-tight text-slate-900">
                            Uploading your introduction
                        </h2>
                        <p className="relative mt-1.5 text-sm leading-relaxed text-slate-600">
                            Please wait while we process your video. This should only take a moment.
                        </p>

                        {uploadProgress > 0 && (
                            <div className="relative mt-5 space-y-1.5">
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
                                    <div className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-violet transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                </div>
                                <p className="text-[11px] font-semibold tabular-nums text-slate-500">{uploadProgress}%</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecordIntroduction;
