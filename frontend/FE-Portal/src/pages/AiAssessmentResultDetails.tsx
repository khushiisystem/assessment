import { sanitizeHtml } from "@/lib/sanitize";
import React, { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
    Users, Video, PlayCircle, ArrowLeft, ChevronDown, ChevronUp,
    AlertCircle, CheckCircle, XCircle, Download, Printer, Loader2, Award, Camera, Mic
} from 'lucide-react';
import { useNavigate, useParams } from "react-router-dom";
import { toast } from '@/hooks/use-toast';
import { generateCertificatePDF } from '@/lib/generateCertificate';
import { useLazyGetAiAssessmentCandidateReportQuery, useGetSignedUrlMutation } from '@/store';
import { formatDateValue } from "@/utils/commonFunctions";
import { PageHeader } from "@/components/common/PageHeader";
import InterviewVideoPlayer from "@/components/InterviewVideoPlayer";
import { usePatchAdminFeedbackMutation } from "@/store/api/assessmentsApi";

interface Question {
  question_number: number;
  question_text: string;
  answer_text: string;
  audio_recording: string | null;
  response_time: number;
  video_timestamp?: number;
  answered: boolean;
  question_type?: string;
  code_answer?: string;
  code_language?: string;
  code_execution_results?: Array<{
    test_case: number;
    passed: boolean;
    points: number;
    is_hidden: boolean;
    expected_output?: string;
    actual_output?: string;
  }>;
  code_marks_earned?: number;
  code_marks_total?: number;
  verification: {
    question_number: number;
    question_text: string;
    covered: string[];
    missing: string[];
    score: number;
    reason: string;
  } | null;
  //     voice_analysis?: VoiceAnalysis | null;
  // }

  // interface VoiceAnalysis {
  //     risk_score?: number;
  //     overall_risk_score?: number;
  //     risk_level: 'low' | 'medium' | 'high';
  //     signals: string[];
  //     audio_duration_seconds?: number;
  //     speech_rate_wpm?: number;
  //     pause_count?: number;
  //     long_pause_count?: number;
  //     longest_pause_seconds?: number;
  //     filler_word_count?: number;
  //     sentence_complexity_delta?: number;
  //     answer_structure_score?: number;
  //     mid_answer_shift_score?: number;
  //     llm_consistency_score?: number;
  //     llm_review?: {
  //         reasoning?: string;
  //         recommended_reviewer_action?: string;
  //         evidence?: string[];
  //     };
  // }

  // interface VoiceFlowSummary {
  //     risk_score?: number;
  //     risk_level?: 'low' | 'medium' | 'high';
  //     average_risk_score?: number;
  //     max_risk_score?: number;
  //     counts?: {
  //         low?: number;
  //         medium?: number;
  //         high?: number;
  //     };
  //     flagged_questions?: number[];
}

interface Candidate {
     id: number;
  name: string;
  email: string;
}

interface Assessment {
  id: number;
  title: string;
  description: string;
  role_type: string;
  experience_level: string;
  start_date: string;
  end_date: string;
}

interface Scores {
  technical_score: number;
  communication_score: number;
  problem_solving_score: number;
  overall_score: number;
}

interface Feedback {
  technical_feedback: string;
  communication_feedback: string;
  problem_solving_feedback: string;
  strengths_feedback: string;
  improvement_feedback: string;
  overall_feedback: string;
}

interface CheatingAlert {
  type: string;
  severity: string;
  message: string;
  timestamp: string;
  screenshot_url: string | null;
}

interface ApiResponse {
  status: string;
  candidate: Candidate;
  assessment: Assessment;
  scores: Scores;
  start_time: string;
  end_time: string;
  feedback: Feedback;
  questions: Question[];
  cheating_alerts: CheatingAlert[];
  gesture_analysis: any;
  introduction_video_url: string;
  interview_video_url: string;
  interview_video_duration?: number; // ← ADD
  certificate_eligible: boolean;
  passing_percentage: number;
  multiple_faces_count: number;
  gaze_violation_count: number;
  face_not_detected_count: number;
  total_proctor_warnings: number;
  // voice_flow_analysis?: VoiceFlowSummary;
  // voice_flow_risk_score?: number;
  // voice_flow_risk_level?: 'low' | 'medium' | 'high';
}

const AiAssessmentResultDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [expandedQuestions, setExpandedQuestions] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState<ApiResponse | null>(null);
    const [expandedVideo, setExpandedVideo] = useState<'intro' | 'interview' | null>(null);
  const [candidatePhoto, setCandidatePhoto] = useState<string | null>(null);
  const [downloadingType, setDownloadingType] = useState<
    "intro" | "interview" | null
  >(null);

  //added
  const [jumpToTime, setJumpToTime] = useState<number | null>(null);

  // ADMIN FEEDBACK STATE
  const [adminFeedback, setAdminFeedback] = useState("");
  const [savedFeedbackText, setSavedFeedbackText] = useState("");
  const [showSideToast, setShowSideToast] = useState(false);
  const [sideToastMessage, setSideToastMessage] = useState("");
  const [sideToastType, setSideToastType] = useState("success"); //addedd ended

  const [isDownloadingProctoring, setIsDownloadingProctoring] = useState(false);
    const [showProctoringPreview, setShowProctoringPreview] = useState(false);
    const [proctoringPdfUrl, setProctoringPdfUrl] = useState<string | null>(null);
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
    const [getReport] = useLazyGetAiAssessmentCandidateReportQuery();
    const [getSignedUrl] = useGetSignedUrlMutation();
    const [patchAdminFeedback] = usePatchAdminFeedbackMutation();

  const videoRef = useRef<HTMLVideoElement>(null);

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      const data = await getReport(Number(id)).unwrap();

      const alerts = data.cheating_alerts || [];
            const multiple_faces_count = alerts.filter((a: any) => a.type === 'multiple_faces').length;
            const gaze_violation_count = alerts.filter((a: any) => a.type === 'gaze').length;
            const face_not_detected_count = alerts.filter((a: any) => a.type === 'no_face').length;
      const total_proctor_warnings = alerts.length;

      setReportData({
        ...data,
        multiple_faces_count,
        gaze_violation_count,
        face_not_detected_count,
                total_proctor_warnings

            });
            setAdminFeedback(data.admin_feedback || "");
            setSavedFeedbackText(data.admin_feedback || "");

        } catch (error) {
            console.error('Error fetching assessment report:', error);
      toast({
        title: "Error",
        description: "Failed to load assessment report",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchReportData();
    }
  }, [id]);

  // Load saved admin feedback from localStorage
  useEffect(() => {
    const savedFeedback = localStorage.getItem(
      `admin_feedback_${reportData?.candidate?.id || id}`,
    );
    if (savedFeedback) {
      setAdminFeedback(savedFeedback);
      setSavedFeedbackText(savedFeedback);
    }
  }, [reportData?.candidate?.id, id]);

  // Function to capture screenshot from video at 5 seconds
  const captureVideoFrame = (videoUrl: string) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
    video.src = videoUrl;
    video.muted = true;

        video.addEventListener('loadedmetadata', () => {
      video.currentTime = 5;
    });

        video.addEventListener('seeked', () => {
      try {
                const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

                const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
          setCandidatePhoto(imageDataUrl);
        }
      } catch (error) {
                console.error('Error capturing video frame:', error);
      }
    });

        video.addEventListener('error', (e) => {
            console.error('Error loading video for screenshot:', e);
    });

    video.load();
  };

    useEffect(() => {
        if (id) {
            fetchReportData();
        }
    }, [id]);

  useEffect(() => {
    if (reportData?.introduction_video_url) {
      captureVideoFrame(reportData.introduction_video_url);
    }
  }, [reportData?.introduction_video_url]);

  const toggleQuestion = (questionNumber: number) => {
        setExpandedQuestions(prev =>
      prev.includes(questionNumber)
                ? prev.filter(num => num !== questionNumber)
                : [...prev, questionNumber]
    );
  };

  const formatDate = (dateString: string) =>
    formatDateValue(
      dateString,
            { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
            dateString
    );

  const getScoreColor = (score: number) => {
    if (score >= 7) return "text-green-600";
    if (score >= 4) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 7) return "bg-green-100 text-green-700 border-green-300";
    if (score >= 4) return "bg-yellow-100 text-yellow-700 border-yellow-300";
    return "bg-red-100 text-red-700 border-red-300";
  };

  const getRecommendation = (score: number) => {
        if (score >= 7) return { text: "Proceed", color: "text-green-600", bg: "bg-green-100" };
        if (score >= 5) return { text: "Consider", color: "text-yellow-600", bg: "bg-yellow-100" };
    return { text: "Reject", color: "text-red-600", bg: "bg-red-100" };
  };

  // const getRiskBadgeColor = (level?: string) => {
  //     if (level === 'high') return "bg-red-100 text-red-700 border-red-300";
  //     if (level === 'medium') return "bg-yellow-100 text-yellow-700 border-yellow-300";
  //     return "bg-green-100 text-green-700 border-green-300";
  // };

  // const formatRiskLevel = (level?: string) => {
  //     if (!level) return "Low";
  //     return level.charAt(0).toUpperCase() + level.slice(1);
  // };

  // const getVoiceRiskScore = (analysis?: VoiceAnalysis | null) =>
  //     Math.round(analysis?.risk_score ?? analysis?.overall_risk_score ?? 0);

    const downloadVideo = async (url: string, filename: string, type: 'intro' | 'interview') => {
    setDownloadingType(type);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast({
        title: "Success",
        description: "Video downloaded successfully",
        duration: 4000,
      });
    } catch (error) {
            console.error('Error downloading video:', error);
      toast({
        title: "Error",
        description: "Failed to download video",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setDownloadingType(null);
    }
  };

  const downloadCertificate = async () => {
    if (!reportData) return;
    const candidatePercentage = (reportData.scores.overall_score / 10) * 100;
    await generateCertificatePDF({
      candidateName: reportData.candidate.name,
      assessmentTitle: reportData.assessment.title,
      scoreDisplay: `${reportData.scores.overall_score.toFixed(1)}/10 (${candidatePercentage.toFixed(0)}%)`,
      percentageValue: candidatePercentage,
            completionDate: new Date(reportData.assessment.start_date).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
      }),
            assessmentType: 'ai',
    });
  };

  //     const downloadProctoringViolations = async () => {
  //         if (!reportData?.cheating_alerts || reportData.cheating_alerts.length === 0) {
  //             toast({ title: "No Violations", description: "No proctoring violations found.", variant: "default" });
  //             return;
  //         }

  //         const screenshotsToDownload = reportData.cheating_alerts.filter(alert => alert.screenshot_url);

  //         if (screenshotsToDownload.length === 0) {
  //             toast({ title: "No Images", description: "No screenshot URLs available.", variant: "default" });
  //             return;
  //         }

  //         setIsDownloadingProctoring(true);
  //         toast({ title: "Starting Download", description: `Processing ${screenshotsToDownload.length} violation images...` });

  //         try {
  //             let downloadedCount = 0;
  //             let errorCount = 0;

  //             for (const alert of screenshotsToDownload) {
  //                 if (alert.screenshot_url) {
  //                     try {
  //                         // 1. Get Signed URL DIRECTLY from Backend
  //                         // We do NOT fetch the alert.screenshot_url first. That causes the 403.
  //                         let signedUrl = "";

  //                         try {
  // const signedResponse = await apiClient.post(
  //     '/api/ai/get-presigned-download-url/',
  //     { file_url: alert.screenshot_url }
  // );
  //                             if (signedResponse.data && signedResponse.data.url) {
  //                                 signedUrl = signedResponse.data.url;
  //                             } else {
  //                                 throw new Error("Backend did not return a signed URL");
  //                             }
  //                         } catch (backendErr) {
  //                             console.error("Backend Signing Failed:", backendErr);
  //                             errorCount++;
  //                             continue;
  //                         }

  //                         // 2. Fetch the Image using the SIGNED URL
  //                         const response = await fetch(signedUrl, { cache: 'no-store' });

  //                         if (!response.ok) {
  //                             throw new Error(`Signed URL fetch failed: ${response.status}`);
  //                         }

  //                         // 3. Download Valid Blob
  //                         const blob = await response.blob();
  //                         const blobUrl = URL.createObjectURL(blob);

  //                         const link = document.createElement('a');
  //                         link.href = blobUrl;
  //                         const timestamp = new Date(alert.timestamp).getTime();
  //                         link.download = `${alert.type}_${timestamp}.jpg`;
  //                         document.body.appendChild(link);
  //                         link.click();
  //                         document.body.removeChild(link);
  //                         URL.revokeObjectURL(blobUrl);

  //                         downloadedCount++;
  //                         // Small delay to prevent browser throttling
  //                         await new Promise(resolve => setTimeout(resolve, 300));

  //                     } catch (err) {
  //                         console.error("Failed to download specific violation image", err);
  //                         errorCount++;
  //                     }
  //                 }
  //             }

  //             if (downloadedCount > 0) {
  //                 toast({
  //                     title: "Download Complete",
  //                     description: `Successfully downloaded ${downloadedCount} violation images.`,
  //                     variant: "default"
  //                 });
  //             }

  //             if (errorCount > 0) {
  //                 toast({
  //                     title: "Download Issues",
  //                     description: `${errorCount} images failed. Check backend configuration.`,
  //                     variant: "destructive",
  //                 });
  //             }

  //         } catch (error) {
  //             console.error("Error downloading violations:", error);
  //             toast({ title: "Error", description: "An error occurred while downloading.", variant: "destructive" });
  //         } finally {
  //             setIsDownloadingProctoring(false);
  //         }
  //     };


  const downloadProctoringViolations = async () => {
    if (!reportData?.cheating_alerts || reportData.cheating_alerts.length === 0) {
        toast({ title: "No Violations", description: "No proctoring violations found.", variant: "default" });
      return;
    }

    const screenshotsToDownload = reportData.cheating_alerts.filter(alert => alert.screenshot_url);

    if (screenshotsToDownload.length === 0) {
        toast({ title: "No Images", description: "No screenshot URLs available.", variant: "default" });
      return;
    }

    setIsDownloadingProctoring(true);
    toast({ title: "Generating PDF", description: `Processing ${screenshotsToDownload.length} violation images...` });

    try {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const PAGE_W = 210;
      const PAGE_H = 297;
      const MARGIN = 15;
      const CONTENT_W = PAGE_W - MARGIN * 2;

      // ── Cover Page Header ─────────────────────────────────────────
      pdf.setFillColor(30, 41, 59);
        pdf.rect(0, 0, PAGE_W, 60, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        pdf.text('PROCTORING VIOLATION REPORT', PAGE_W / 2, 25, { align: 'center' });

      pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.text(reportData.candidate.name, PAGE_W / 2, 38, { align: 'center' });
        pdf.text(reportData.candidate.email, PAGE_W / 2, 46, { align: 'center' });
        pdf.text(`Generated: ${new Date().toLocaleString()}`, PAGE_W / 2, 54, { align: 'center' });

      // ── Summary Box ───────────────────────────────────────────────
      let y = 72;
      pdf.setTextColor(30, 41, 59);
      pdf.setFillColor(241, 245, 249);
        pdf.roundedRect(MARGIN, y, CONTENT_W, 58, 3, 3, 'F');

      pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('ASSESSMENT SUMMARY', MARGIN + 5, y + 10);

      pdf.setFontSize(9);
      const leftItems = [
            ['Assessment:', reportData.assessment.title],
            ['Role:', reportData.assessment.role_type.replace(/_/g, ' ')],
            ['Experience:', reportData.assessment.experience_level.replace(/_/g, ' ')],
      ];
      const rightItems = [
            ['Total Violations:', String(screenshotsToDownload.length)],
            ['Multiple Faces:', String(reportData.multiple_faces_count || 0)],
            ['Gaze Alerts:', String(reportData.gaze_violation_count || 0)],
            ['Face Not Detected:', String(reportData.face_not_detected_count || 0)],
      ];

      leftItems.forEach(([label, value], i) => {
            pdf.setFont('helvetica', 'bold');
        pdf.text(label, MARGIN + 5, y + 22 + i * 11);
            pdf.setFont('helvetica', 'normal');
        pdf.text(value, MARGIN + 42, y + 22 + i * 11);
      });

      rightItems.forEach(([label, value], i) => {
            pdf.setFont('helvetica', 'bold');
        pdf.text(label, PAGE_W / 2 + 5, y + 22 + i * 9);
            pdf.setFont('helvetica', 'normal');
        pdf.text(value, PAGE_W / 2 + 50, y + 22 + i * 9);
      });

      y += 68;

      // ── Violation Timeline Table ──────────────────────────────────
        pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
        pdf.text('VIOLATION TIMELINE', MARGIN, y + 8);
      y += 14;

      // Table header
      pdf.setFillColor(30, 41, 59);
        pdf.rect(MARGIN, y, CONTENT_W, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.text('#', MARGIN + 3, y + 5.5);
        pdf.text('Type', MARGIN + 12, y + 5.5);
        pdf.text('Severity', MARGIN + 75, y + 5.5);
        pdf.text('Timestamp', MARGIN + 108, y + 5.5);
        pdf.text('Video Time', MARGIN + 145, y + 5.5);
      y += 8;

      pdf.setTextColor(30, 41, 59);
      screenshotsToDownload.forEach((alert, idx) => {
        if (y > PAGE_H - 20) {
          pdf.addPage();
          y = MARGIN;
        }
            
            
            const violationTime = new Date(alert.timestamp).getTime();
            const startTime = new Date(reportData.start_time).getTime();
            let videoSeconds = Math.floor((violationTime - startTime) / 1000);
            if (videoSeconds < 0) videoSeconds = 0;
            const mins = Math.floor(videoSeconds / 60);
            const secs = videoSeconds % 60;
            const videoTime = `${mins}:${secs.toString().padStart(2, '0')}`;
            
            pdf.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
            pdf.rect(MARGIN, y, CONTENT_W, 7, 'F');
            pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.text(String(idx + 1), MARGIN + 3, y + 5);
            pdf.text(alert.type.replace(/_/g, ' ').toUpperCase(), MARGIN + 12, y + 5);
            pdf.text(alert.severity.toUpperCase(), MARGIN + 65, y + 5);
            pdf.text(new Date(alert.timestamp).toLocaleString(), MARGIN + 95, y + 5);
            pdf.text(videoTime, MARGIN + 145, y + 5);
        y += 7;
      });

      // ── One Page Per Screenshot ───────────────────────────────────
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < screenshotsToDownload.length; i++) {
        const alert = screenshotsToDownload[i];
        if (!alert.screenshot_url) continue;

        try {
          // Get presigned URL
                const signedResponse = await getSignedUrl({ file_url: alert.screenshot_url }).unwrap();
          if (!signedResponse?.url) throw new Error("No signed URL returned");

          // Fetch image as blob
                const imgResponse = await fetch(signedResponse.url, { cache: 'no-store' });
                if (!imgResponse.ok) throw new Error(`Fetch failed: ${imgResponse.status}`);

          const blob = await imgResponse.blob();
                const mimeType = blob.type || 'image/jpeg';

          // Convert to base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          // Get image dimensions
          const imgEl = new Image();
          await new Promise<void>((resolve) => {
            imgEl.onload = () => resolve();
            imgEl.onerror = () => resolve();
            imgEl.src = `data:${mimeType};base64,${base64}`;
          });

          pdf.addPage();

          // Page header bar
          pdf.setFillColor(30, 41, 59);
                pdf.rect(0, 0, PAGE_W, 18, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(9);
                pdf.setFont('helvetica', 'bold');
                pdf.text(`VIOLATION #${i + 1} — ${alert.type.replace(/_/g, ' ').toUpperCase()}`, MARGIN, 11);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`${i + 1} / ${screenshotsToDownload.length}`, PAGE_W - MARGIN, 11, { align: 'right' });

          // Details box
          pdf.setTextColor(30, 41, 59);
          pdf.setFillColor(241, 245, 249);
                pdf.roundedRect(MARGIN, 22, CONTENT_W, 22, 2, 2, 'F');

          pdf.setFontSize(9);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Type:', MARGIN + 4, 30);
                pdf.text('Severity:', MARGIN + 4, 39);
                pdf.text('Timestamp:', PAGE_W / 2, 30);
                pdf.text('Message:', PAGE_W / 2, 39);

                pdf.setFont('helvetica', 'normal');
                pdf.text(alert.type.replace(/_/g, ' ').toUpperCase(), MARGIN + 20, 30);

          // Severity with color
          const sev = alert.severity?.toLowerCase();
                if (sev === 'high') pdf.setTextColor(220, 38, 38);
                else if (sev === 'medium') pdf.setTextColor(180, 120, 10);
          else pdf.setTextColor(40, 167, 93);
                pdf.text((alert.severity || '').toUpperCase(), MARGIN + 26, 39);
          pdf.setTextColor(30, 41, 59);

                pdf.text(new Date(alert.timestamp).toLocaleString(), PAGE_W / 2 + 24, 30);
          const msg = alert.message
            ? pdf.splitTextToSize(alert.message, 55)[0]
                    : '—';
          pdf.text(msg, PAGE_W / 2 + 24, 39);

          // Screenshot image — scale to fit
          const IMG_Y = 48;
          const MAX_W = CONTENT_W;
          const MAX_H = PAGE_H - IMG_Y - MARGIN - 10;

          let imgW = MAX_W;
          let imgH = MAX_H;
          if (imgEl.naturalWidth && imgEl.naturalHeight) {
            const ratio = imgEl.naturalWidth / imgEl.naturalHeight;
            if (MAX_W / ratio <= MAX_H) {
              imgW = MAX_W;
              imgH = MAX_W / ratio;
            } else {
              imgH = MAX_H;
              imgW = MAX_H * ratio;
            }
          }

          const imgX = MARGIN + (CONTENT_W - imgW) / 2;
          pdf.addImage(
            `data:${mimeType};base64,${base64}`,
                    mimeType.includes('png') ? 'PNG' : 'JPEG',
                    imgX, IMG_Y, imgW, imgH
          );

          // Timestamp below image
          pdf.setFontSize(7);
          pdf.setTextColor(120, 120, 120);
          pdf.text(
            new Date(alert.timestamp).toLocaleString(),
                    PAGE_W / 2, IMG_Y + imgH + 6,
                    { align: 'center' }
          );

          successCount++;

        } catch (err) {
          console.error(`Failed to process violation #${i + 1}:`, err);
          pdf.addPage();
          pdf.setFillColor(254, 242, 242);
                pdf.rect(MARGIN, 40, CONTENT_W, 20, 'F');
          pdf.setTextColor(220, 38, 38);
          pdf.setFontSize(10);
                pdf.text(`Violation #${i + 1}: Image could not be loaded`, PAGE_W / 2, 53, { align: 'center' });
          pdf.setTextColor(30, 41, 59);
          errorCount++;
        }

            await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Save the PDF
        const fileName = `proctoring_${reportData.candidate.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      pdf.save(fileName);

      toast({
        title: "PDF Downloaded",
        description: `Report with ${successCount} screenshots saved successfully.`,
            variant: "default"
      });

      if (errorCount > 0) {
        toast({
          title: "Some images failed",
          description: `${errorCount} images could not be loaded.`,
                variant: "destructive"
        });
      }

    } catch (error) {
      console.error("Error generating PDF:", error);
        toast({ title: "Error", description: "Failed to generate PDF report.", variant: "destructive" });
    } finally {
        setIsDownloadingProctoring(false);
    }
    };

const previewProctoringReport = async () => {
    if (!reportData?.cheating_alerts || reportData.cheating_alerts.length === 0) {
        toast({ title: "No Violations", description: "No proctoring violations found.", variant: "default" });
        return;
    }

    const screenshotsToDownload = reportData.cheating_alerts.filter(alert => alert.screenshot_url);

    if (screenshotsToDownload.length === 0) {
        toast({ title: "No Images", description: "No screenshot URLs available.", variant: "default" });
        return;
    }

    setIsGeneratingPreview(true);
    toast({ title: "Generating Report", description: `Processing ${screenshotsToDownload.length} violation images...` });

    try {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        const PAGE_W = 210;
        const PAGE_H = 297;
        const MARGIN = 15;
        const CONTENT_W = PAGE_W - MARGIN * 2;

        // Cover Page Header
        pdf.setFillColor(30, 41, 59);
        pdf.rect(0, 0, PAGE_W, 60, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        pdf.text('PROCTORING VIOLATION REPORT', PAGE_W / 2, 25, { align: 'center' });

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.text(reportData.candidate.name, PAGE_W / 2, 38, { align: 'center' });
        pdf.text(reportData.candidate.email, PAGE_W / 2, 46, { align: 'center' });
        pdf.text(`Generated: ${new Date().toLocaleString()}`, PAGE_W / 2, 54, { align: 'center' });

        let y = 72;
        pdf.setTextColor(30, 41, 59);
        pdf.setFillColor(241, 245, 249);
        pdf.roundedRect(MARGIN, y, CONTENT_W, 58, 3, 3, 'F');

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('ASSESSMENT SUMMARY', MARGIN + 5, y + 10);

        pdf.setFontSize(9);
        const leftItems = [
            ['Assessment:', reportData.assessment.title],
            ['Role:', reportData.assessment.role_type.replace(/_/g, ' ')],
            ['Experience:', reportData.assessment.experience_level.replace(/_/g, ' ')],
        ];
        const rightItems = [
            ['Total Violations:', String(screenshotsToDownload.length)],
            ['Multiple Faces:', String(reportData.multiple_faces_count || 0)],
            ['Gaze Alerts:', String(reportData.gaze_violation_count || 0)],
            ['Face Not Detected:', String(reportData.face_not_detected_count || 0)],
        ];

        leftItems.forEach(([label, value], i) => {
            pdf.setFont('helvetica', 'bold');
            pdf.text(label, MARGIN + 5, y + 22 + i * 11);
            pdf.setFont('helvetica', 'normal');
            pdf.text(value, MARGIN + 42, y + 22 + i * 11);
        });

        rightItems.forEach(([label, value], i) => {
            pdf.setFont('helvetica', 'bold');
            pdf.text(label, PAGE_W / 2 + 5, y + 22 + i * 9);
            pdf.setFont('helvetica', 'normal');
            pdf.text(value, PAGE_W / 2 + 50, y + 22 + i * 9);
        });

        y += 68;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text('VIOLATION TIMELINE', MARGIN, y + 8);
        y += 14;

        pdf.setFillColor(30, 41, 59);
        pdf.rect(MARGIN, y, CONTENT_W, 8, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.text('#', MARGIN + 3, y + 5.5);
        pdf.text('Type', MARGIN + 12, y + 5.5);
        pdf.text('Severity', MARGIN + 60, y + 5.5);
        pdf.text('Timestamp', MARGIN + 95, y + 5.5);
        pdf.text('Video Time', MARGIN + 145, y + 5.5);
        y += 8;

        pdf.setTextColor(30, 41, 59);
     screenshotsToDownload.forEach((alert, idx) => {
    if (y > PAGE_H - 20) {
        pdf.addPage();
        y = MARGIN;
    }
    
    //  VIDEO TIME CALCULATE
    const violationTime = new Date(alert.timestamp).getTime();
    const startTime = new Date(reportData.start_time).getTime();
    let videoSeconds = Math.floor((violationTime - startTime) / 1000);
    if (videoSeconds < 0) videoSeconds = 0;
    const mins = Math.floor(videoSeconds / 60);
    const secs = videoSeconds % 60;
    const videoTime = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    pdf.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
    pdf.rect(MARGIN, y, CONTENT_W, 7, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(String(idx + 1), MARGIN + 3, y + 5);
    pdf.text(alert.type.replace(/_/g, ' ').toUpperCase(), MARGIN + 12, y + 5);
    pdf.text(alert.severity.toUpperCase(), MARGIN + 60, y + 5);
    pdf.text(new Date(alert.timestamp).toLocaleString(), MARGIN + 95, y + 5);
    pdf.text(videoTime, MARGIN + 145, y + 5);  // 🔴 VIDEO TIME ADD KARO
    y += 7;
});

        for (let i = 0; i < screenshotsToDownload.length; i++) {
            const alert = screenshotsToDownload[i];
            if (!alert.screenshot_url) continue;

            try {
                const signedResponse = await getSignedUrl({ file_url: alert.screenshot_url }).unwrap();
                if (!signedResponse?.url) throw new Error("No signed URL returned");

                const imgResponse = await fetch(signedResponse.url, { cache: 'no-store' });
                if (!imgResponse.ok) throw new Error(`Fetch failed: ${imgResponse.status}`);

                const blob = await imgResponse.blob();
                const mimeType = blob.type || 'image/jpeg';

                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });

                const imgEl = new Image();
                await new Promise<void>((resolve) => {
                    imgEl.onload = () => resolve();
                    imgEl.onerror = () => resolve();
                    imgEl.src = `data:${mimeType};base64,${base64}`;
                });

                pdf.addPage();

                pdf.setFillColor(30, 41, 59);
                pdf.rect(0, 0, PAGE_W, 18, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'bold');
                pdf.text(`VIOLATION #${i + 1} — ${alert.type.replace(/_/g, ' ').toUpperCase()}`, MARGIN, 11);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`${i + 1} / ${screenshotsToDownload.length}`, PAGE_W - MARGIN, 11, { align: 'right' });

                pdf.setTextColor(30, 41, 59);
                pdf.setFillColor(241, 245, 249);
                pdf.roundedRect(MARGIN, 22, CONTENT_W, 22, 2, 2, 'F');

                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Type:', MARGIN + 4, 30);
                pdf.text('Severity:', MARGIN + 4, 39);
                pdf.text('Timestamp:', PAGE_W / 2, 30);
                pdf.text('Message:', PAGE_W / 2, 39);

                pdf.setFont('helvetica', 'normal');
                pdf.text(alert.type.replace(/_/g, ' ').toUpperCase(), MARGIN + 20, 30);

                const sev = alert.severity?.toLowerCase();
                if (sev === 'high') pdf.setTextColor(220, 38, 38);
                else if (sev === 'medium') pdf.setTextColor(180, 120, 10);
                else pdf.setTextColor(40, 167, 93);
                pdf.text((alert.severity || '').toUpperCase(), MARGIN + 26, 39);
                pdf.setTextColor(30, 41, 59);

                pdf.text(new Date(alert.timestamp).toLocaleString(), PAGE_W / 2 + 24, 30);
                const msg = alert.message ? pdf.splitTextToSize(alert.message, 55)[0] : '—';
                pdf.text(msg, PAGE_W / 2 + 24, 39);

                const IMG_Y = 48;
                const MAX_W = CONTENT_W;
                const MAX_H = PAGE_H - IMG_Y - MARGIN - 10;

                let imgW = MAX_W;
                let imgH = MAX_H;
                if (imgEl.naturalWidth && imgEl.naturalHeight) {
                    const ratio = imgEl.naturalWidth / imgEl.naturalHeight;
                    if (MAX_W / ratio <= MAX_H) {
                        imgW = MAX_W;
                        imgH = MAX_W / ratio;
                    } else {
                        imgH = MAX_H;
                        imgW = MAX_H * ratio;
                    }
                }

                const imgX = MARGIN + (CONTENT_W - imgW) / 2;
                pdf.addImage(`data:${mimeType};base64,${base64}`, mimeType.includes('png') ? 'PNG' : 'JPEG', imgX, IMG_Y, imgW, imgH);

                pdf.setFontSize(7);
                pdf.setTextColor(120, 120, 120);
                pdf.text(new Date(alert.timestamp).toLocaleString(), PAGE_W / 2, IMG_Y + imgH + 6, { align: 'center' });

            } catch (err) {
                console.error(`Failed to process violation #${i + 1}:`, err);
                pdf.addPage();
                pdf.setFillColor(254, 242, 242);
                pdf.rect(MARGIN, 40, CONTENT_W, 20, 'F');
                pdf.setTextColor(220, 38, 38);
                pdf.setFontSize(10);
                pdf.text(`Violation #${i + 1}: Image could not be loaded`, PAGE_W / 2, 53, { align: 'center' });
                pdf.setTextColor(30, 41, 59);
            }

            await new Promise(resolve => setTimeout(resolve, 200));
        }

        
        // 🔴 NEW TAB MEIN OPEN KARO (PEHLE JESA)
            const pdfBlob = pdf.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            window.open(pdfUrl, '_blank');

            setTimeout(() => {
                URL.revokeObjectURL(pdfUrl);
            }, 60000);

      toast({
                title: "Report Generated",
                description: "Proctoring report opened in new tab.",
                variant: "default"
            });

    } catch (error) {
        console.error("Error generating report:", error);
        toast({ title: "Error", description: "Failed to generate report.", variant: "destructive" });
    } finally {
        setIsGeneratingPreview(false);
    }
  };
// 🔴 YEH CLOSE FUNCTION ADD KARO 🔴
const closeProctoringPreview = () => {
    if (proctoringPdfUrl) {
        URL.revokeObjectURL(proctoringPdfUrl);
        setProctoringPdfUrl(null);
    }
    setShowProctoringPreview(false);
};
  // Side Toast Popup Component
  const SideToast = ({ message, type, onClose }) => {
    useEffect(() => {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }, [onClose]);

    return (
      <div className="fixed bottom-20 right-4 z-50 animate-in slide-in-from-right-5 duration-300">
        <div
          className={`rounded-lg shadow-lg p-4 ${
            type === "success" ? "bg-green-500" : "bg-red-500"
          } text-white min-w-[250px] flex items-center gap-2`}
        >
          {type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">{message}</span>
        </div>
      </div>
    );
  };

  const printReport = () => {
    if (!reportData) return;

        const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "Error",
        description: "Please allow pop-ups to print the report",
        variant: "destructive",
      });
      return;
    }

    const recommendation = getRecommendation(reportData?.scores?.overall_score);
        const assessmentDate = formatDate(reportData.assessment.start_date).split(' ').slice(0, 4).join(' ');

    const printContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${reportData.candidate.name} - ${reportData.assessment.title} Report</title>
    <style>
        @media print {
            @page {
                margin: 15mm;
                size: A4;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 0;
                font-size: 11px;
                line-height: 1.4;
                color: #333;
                background: #fff !important;
            }
            
            .no-print { display: none !important; }
            .page-break { page-break-before: always; }
            .avoid-break { page-break-inside: avoid; }
            
            .print-container {
                width: 100% !important;
                max-width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            
            .card {
                border: 1px solid #ddd !important;
                border-radius: 4px !important;
                margin-bottom: 15px !important;
                break-inside: avoid;
            }
            
            .card-header {
                background-color: #f8f9fa !important;
                border-bottom: 1px solid #ddd !important;
                padding: 10px !important;
                font-weight: 600 !important;
            }
            
            .card-body {
                padding: 15px !important;
            }
            
            .score-badge {
                display: inline-block;
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 10px;
                font-weight: 600;
            }
            
            .bg-success { background-color: #d4edda !important; color: #155724 !important; }
            .bg-warning { background-color: #fff3cd !important; color: #856404 !important; }
            .bg-danger { background-color: #f8d7da !important; color: #721c24 !important; }
            
            .candidate-photo {
                width: 150px;
                height: 150px;
                object-fit: cover;
                border-radius: 8px;
                border: 3px solid #007bff;
                display: block;
                margin: 0 auto 15px auto;
            }
            
            table {
                width: 100%;
                border-collapse: collapse;
                font-size: 10px;
                margin: 10px 0;
            }
            
            th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }
            
            th {
                background-color: #f8f9fa;
                font-weight: 600;
            }
            
            .text-center { text-align: center !important; }
            .text-right { text-align: right !important; }
            .mb-3 { margin-bottom: 15px !important; }
            .mb-2 { margin-bottom: 10px !important; }
            .mt-3 { margin-top: 15px !important; }
            .p-3 { padding: 15px !important; }
            
            .header-section {
                display: grid;
                grid-template-columns: 1fr 2fr 1fr;
                gap: 20px;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid #007bff;
            }
            
            .header-photo {
                text-align: center;
            }
            
            .header-title {
                text-align: center;
            }
            
            .header-logo {
                text-align: right;
                color: #6c757d;
                font-size: 9px;
            }
        }
        
        @media screen {
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 20px;
                background-color: #f5f5f5;
            }
            
            .print-container {
                max-width: 210mm;
                margin: 0 auto;
                background: white;
                padding: 20px;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            
            .candidate-photo {
                width: 150px;
                height: 150px;
                object-fit: cover;
                border-radius: 8px;
                border: 3px solid #007bff;
                display: block;
                margin: 0 auto 15px auto;
            }
            
            .header-section {
                display: grid;
                grid-template-columns: 1fr 2fr 1fr;
                gap: 20px;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid #007bff;
            }
            
            .header-photo {
                text-align: center;
            }
            
            .header-title {
                text-align: center;
            }
            
            .header-logo {
                text-align: right;
                color: #6c757d;
                font-size: 9px;
            }
            
            .print-button {
                background: #007bff;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                margin: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="print-container">
        <!-- Header with Photo -->
        <div class="header-section">
            <div class="header-photo">
                ${candidatePhoto ? `<img src="${candidatePhoto}" alt="Candidate Photo" class="candidate-photo" />` : '<div style="width: 150px; height: 150px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin: 0 auto;"><span style="color: #999;">No Photo</span></div>'}
            </div>
            <div class="header-title">
                <h1 style="color: #2c3e50; margin: 0 0 5px 0; font-size: 20px;">AI INTERVIEW ASSESSMENT REPORT</h1>
                <div style="color: #007bff; font-size: 14px; font-weight: 600; margin: 5px 0;">
                    ${reportData.candidate.name}
                </div>
                <div style="color: #6c757d; font-size: 10px;">
                    ${reportData.assessment.role_type.replace(/_/g, ' ').toUpperCase()} | ${reportData.assessment.experience_level.replace(/_/g, ' ')}
                </div>
            </div>
            <div class="header-logo">
                <div style="font-weight: 600; margin-bottom: 3px;">REPORT ID</div>
                <div>${reportData.assessment.id}_${reportData.candidate.name.replace(/\s+/g, '_')}</div>
                <div style="margin-top: 10px;">Generated:</div>
                <div>${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            </div>
        </div>
        
        <!-- Candidate & Assessment Info -->
        <div class="card avoid-break mb-3">
            <div class="card-header">CANDIDATE & ASSESSMENT DETAILS</div>
            <div class="card-body">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <h4 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 12px;">Candidate Information</h4>
                        <table>
                            <tr><td style="width: 40%;"><strong>Name:</strong></td><td>${reportData.candidate.name}</td></tr>
                            <tr><td><strong>Email:</strong></td><td>${reportData.candidate.email}</td></tr>
                            <tr><td><strong>Interview Date:</strong></td><td>${assessmentDate}</td></tr>
                            <tr><td><strong>Interview ID:</strong></td><td>${reportData.assessment.id}</td></tr>
                        </table>
                    </div>
                    <div>
                        <h4 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 12px;">Assessment Details</h4>
                        <table>
                            <tr><td style="width: 40%;"><strong>Role:</strong></td><td>${reportData.assessment.role_type.replace(/_/g, ' ')}</td></tr>
                            <tr><td><strong>Experience Level:</strong></td><td>${reportData.assessment.experience_level.replace(/_/g, ' ')}</td></tr>
                            <tr><td><strong>Assessment:</strong></td><td>${reportData.assessment.title}</td></tr>
                            <tr><td><strong>Status:</strong></td><td><span class="score-badge bg-success">Completed</span></td></tr>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Scores & Recommendation -->
        <div class="card avoid-break mb-3">
            <div class="card-header">PERFORMANCE SUMMARY</div>
            <div class="card-body">
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
                    <div>
                        <h4 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 12px;">SKILL SCORES</h4>
                        <table>
                            <thead>
                                <tr>
                                    <th>Skill</th>
                                    <th>Score</th>
                                    <th>Percentage</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="background-color: #f8f9fa;">
                                    <td><strong>Overall</strong></td>
                                    <td><strong>${reportData.scores.overall_score.toFixed(1)}/10</strong></td>
                                    <td><strong>${(reportData.scores.overall_score * 10).toFixed(0)}%</strong></td>
                                </tr>
                                <tr>
                                    <td>Technical</td>
                                    <td>${reportData.scores.technical_score.toFixed(1)}/10</td>
                                    <td>${(reportData.scores.technical_score * 10).toFixed(0)}%</td>
                                </tr>
                                <tr>
                                    <td>Communication</td>
                                    <td>${reportData.scores.communication_score.toFixed(1)}/10</td>
                                    <td>${(reportData.scores.communication_score * 10).toFixed(0)}%</td>
                                </tr>
                                <tr>
                                    <td>Problem Solving</td>
                                    <td>${reportData.scores.problem_solving_score.toFixed(1)}/10</td>
                                    <td>${(reportData.scores.problem_solving_score * 10).toFixed(0)}%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div style="text-align: center;">
                        <h4 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 12px;">RECOMMENDATION</h4>
                        <div style="font-size: 28px; font-weight: bold; ${recommendation.color.replace("text-", "color: ")}; margin: 10px 0;">
                            ${recommendation.text.toUpperCase()}
                        </div>
                        <div style="font-size: 48px; font-weight: bold; color: #2c3e50; margin: 15px 0;">
                            ${(reportData.scores.overall_score * 10).toFixed(0)}
                        </div>
                        <div style="font-size: 11px; color: #6c757d; font-weight: 600;">
                            OUT OF 100
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Proctoring Summary -->
        <div class="card avoid-break mb-3">
            <div class="card-header">PROCTORING & INTEGRITY SUMMARY</div>
            <div class="card-body">
                <table>
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th style="text-align: center;">Count</th>
                            <th style="text-align: center;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Multiple Faces Detected</td>
                            <td style="text-align: center; font-weight: 600;">${reportData.multiple_faces_count || 0}</td>
                            <td style="text-align: center;">
                                <span class="score-badge ${reportData.multiple_faces_count > 0 ? 'bg-danger' : 'bg-success'}">
                                    ${reportData.multiple_faces_count > 0 ? 'Alert' : 'Clear'}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td>Gaze Movement Violations</td>
                            <td style="text-align: center; font-weight: 600;">${reportData.gaze_violation_count || 0}</td>
                            <td style="text-align: center;">
                                <span class="score-badge ${reportData.gaze_violation_count > 2 ? 'bg-warning' : 'bg-success'}">
                                    ${reportData.gaze_violation_count > 2 ? 'Warning' : 'Clear'}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td>Face Not Detected Instances</td>
                            <td style="text-align: center; font-weight: 600;">${reportData.face_not_detected_count || 0}</td>
                            <td style="text-align: center;">
                                <span class="score-badge ${reportData.face_not_detected_count > 0 ? 'bg-danger' : 'bg-success'}">
                                    ${reportData.face_not_detected_count > 0 ? 'Alert' : 'Clear'}
                                </span>
                            </td>
                        </tr>
                        <tr style="background-color: #f8f9fa;">
                            <td><strong>Total Proctor Warnings</strong></td>
                            <td style="text-align: center; font-weight: 600;"><strong>${reportData.total_proctor_warnings || 0}</strong></td>
                            <td style="text-align: center;">
                                <span class="score-badge ${reportData.total_proctor_warnings > 5 ? 'bg-danger' : reportData.total_proctor_warnings > 2 ? 'bg-warning' : 'bg-success'}">
                                    ${reportData.total_proctor_warnings > 5 ? 'High Risk' : reportData.total_proctor_warnings > 2 ? 'Moderate' : 'Low Risk'}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <!-- Key Insights -->
        <div class="card avoid-break mb-3">
            <div class="card-header">KEY INSIGHTS & FEEDBACK</div>
            <div class="card-body">
                ${reportData.feedback.strengths_feedback ? `
                    <div style="margin-bottom: 15px;">
                        <div style="background-color: #d4edda; padding: 10px; border-left: 4px solid #28a745; border-radius: 4px;">
                            <strong style="color: #155724; font-size: 11px;">✓ STRENGTHS</strong>
                            <p style="margin: 5px 0 0 0; font-size: 10px; color: #155724;">${reportData.feedback.strengths_feedback}</p>
                        </div>
                    </div>
                ` : ''}
                
                ${reportData.feedback.improvement_feedback ? `
                    <div style="margin-bottom: 15px;">
                        <div style="background-color: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; border-radius: 4px;">
                            <strong style="color: #856404; font-size: 11px;">⚠ AREAS FOR IMPROVEMENT</strong>
                            <p style="margin: 5px 0 0 0; font-size: 10px; color: #856404;">${reportData.feedback.improvement_feedback}</p>
                        </div>
                    </div>
                ` : ''}
                
                ${reportData.feedback.overall_feedback ? `
                    <div style="margin-bottom: 15px;">
                        <div style="background-color: #e7f1ff; padding: 10px; border-left: 4px solid #007bff; border-radius: 4px;">
                            <strong style="color: #004085; font-size: 11px;">📊 OVERALL ASSESSMENT</strong>
                            <p style="margin: 5px 0 0 0; font-size: 10px; color: #004085;">${reportData.feedback.overall_feedback}</p>
                        </div>
                    </div>
                ` : ''}
                
                ${reportData.feedback.technical_feedback ? `
                    <div style="margin-bottom: 15px;">
                        <div style="background-color: #f8f9fa; padding: 10px; border-left: 4px solid #6c757d; border-radius: 4px;">
                            <strong style="color: #495057; font-size: 11px;">💻 TECHNICAL FEEDBACK</strong>
                            <p style="margin: 5px 0 0 0; font-size: 10px; color: #495057;">${reportData.feedback.technical_feedback}</p>
                        </div>
                    </div>
                ` : ''}
                
                ${reportData.feedback.communication_feedback ? `
                    <div style="margin-bottom: 15px;">
                        <div style="background-color: #f8f9fa; padding: 10px; border-left: 4px solid #6c757d; border-radius: 4px;">
                            <strong style="color: #495057; font-size: 11px;">💬 COMMUNICATION FEEDBACK</strong>
                            <p style="margin: 5px 0 0 0; font-size: 10px; color: #495057;">${reportData.feedback.communication_feedback}</p>
                        </div>
                    </div>
                ` : ''}
                
                ${reportData.feedback.problem_solving_feedback ? `
                    <div>
                        <div style="background-color: #f8f9fa; padding: 10px; border-left: 4px solid #6c757d; border-radius: 4px;">
                            <strong style="color: #495057; font-size: 11px;">🧩 PROBLEM SOLVING FEEDBACK</strong>
                            <p style="margin: 5px 0 0 0; font-size: 10px; color: #495057;">${reportData.feedback.problem_solving_feedback}</p>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
        
        <!-- Question Summary -->
        <div class="card avoid-break">
            <div class="card-header">QUESTION SUMMARY (${reportData.questions.length} Questions)</div>
            <div class="card-body">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%;">Q#</th>
                            <th>Question</th>
                            <th style="width: 12%; text-align: center;">Score</th>
                            <th style="width: 12%; text-align: center;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.questions.map((q, idx) => `
                            <tr>
                                <td style="text-align: center; font-weight: 600;">${q.question_number}</td>
                                <td style="font-size: 9px;">${q.question_text.substring(0, 120)}${q.question_text.length > 120 ? '...' : ''}</td>
                                <td style="text-align: center; font-weight: 600;">${q.verification?.score || 'N/A'}/10</td>
                                <td style="text-align: center;">
                                    <span class="score-badge ${q.answered ? 'bg-success' : 'bg-danger'}">
                                        ${q.answered ? '✓ Answered' : '✗ Not Answered'}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <!-- Statistics Summary -->
                <div style="margin-top: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center;">
                        <div>
                            <div style="font-size: 9px; color: #6c757d; margin-bottom: 3px;">Total Questions</div>
                            <div style="font-size: 18px; font-weight: 600; color: #2c3e50;">${reportData.questions.length}</div>
                        </div>
                        <div>
                            <div style="font-size: 9px; color: #6c757d; margin-bottom: 3px;">Answered</div>
                            <div style="font-size: 18px; font-weight: 600; color: #28a745;">${reportData.questions.filter(q => q.answered).length}</div>
                        </div>
                        <div>
                            <div style="font-size: 9px; color: #6c757d; margin-bottom: 3px;">Average Score</div>
                            <div style="font-size: 18px; font-weight: 600; color: #007bff;">
                                ${reportData.questions.filter(q => q.verification?.score).length > 0
                ? (reportData.questions.filter(q => q.verification?.score).reduce((sum, q) => sum + (q.verification?.score || 0), 0) / reportData.questions.filter(q => q.verification?.score).length).toFixed(1)
                : 'N/A'}/10
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #007bff; font-size: 9px; color: #6c757d;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: #2c3e50;">CONFIDENTIAL REPORT</strong><br>
                    Generated by AI Interview Assessment System<br>
                    This report contains proprietary and confidential information
                </div>
                <div style="text-align: right;">
                    <strong>Report Date:</strong><br>
                    ${new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                    })}<br>
                    ${new Date().toLocaleTimeString('en-US')}
                </div>
            </div>
        </div>
    </div>
    
    <div class="no-print" style="text-align: center; margin-top: 20px;">
        <button class="print-button" onclick="window.print()">🖨️ Print Report</button>
        <button class="print-button" style="background: #6c757d; margin-left: 10px;" onclick="window.close()">✕ Close</button>
    </div>
    
    <script>
        window.onload = function() {
            setTimeout(() => {
                window.print();
                window.onafterprint = function() {
                    setTimeout(() => {
                        // Don't auto-close, let user close manually
                    }, 1000);
                };
            }, 1500);
        };
    </script>
</body>
</html>
`;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading report...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!reportData) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <p className="mt-4 text-slate-600">No report data found</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const { candidate, assessment, questions, scores, feedback } = reportData;
  const recommendation = getRecommendation(scores.overall_score);

  const totalQuestions = questions.length;
    const answeredQuestions = questions.filter(q => {
        if (q.question_type === 'coding') return q.answered && (q.code_answer || '').trim() !== '';
        return q.answered && q.answer_text.trim() !== '';
  }).length;
    const scored = questions.filter(q => q.verification?.score);
  const averageScore = scored.length
    ? Math.round(
            scored.reduce((sum, q) => sum + q.verification!.score, 0) / scored.length
      )
    : 0;
  // const voiceSummary = reportData.voice_flow_analysis || {};
  // const voiceCounts = voiceSummary.counts || {};
  // const voiceRiskLevel = reportData.voice_flow_risk_level || voiceSummary.risk_level || 'low';
  // const voiceRiskScore = Math.round(reportData.voice_flow_risk_score ?? voiceSummary.risk_score ?? 0);
  // const voiceAnalysedQuestions = questions.filter(q => q.voice_analysis);
  // const hasVoiceAnalysis =
  //     voiceAnalysedQuestions.length > 0 ||
  //     voiceRiskScore > 0 ||
  //     (voiceCounts.medium || 0) > 0 ||
  //     (voiceCounts.high || 0) > 0;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 print:bg-white">
        <div className="max-w-9xl mx-auto ">
          {/* HEADER */}
          <PageHeader
            className="mb-4"
            title="AI Interview Report"
            actions={
              <>
                {reportData.certificate_eligible && (
                  <button
                    title="Download Certificate"
                    onClick={downloadCertificate}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-brand-purple to-brand-violet text-white rounded-xl shadow-sm hover:brightness-110 transition-all duration-200 text-sm"
                  >
                    <Award className="w-3 h-3" />
                    <span className="hidden sm:inline">Certificate</span>
                  </button>
                )}
                                 <button
                                title="Preview Proctoring Report"
                                onClick={previewProctoringReport}
                                disabled={isGeneratingPreview}
                                className="flex items-center gap-1 px-3 py-1.5 bg-slate-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm"
                            >
                                {isGeneratingPreview ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <Camera className="w-3 h-3" />
                                )}
                                <span className="hidden sm:inline">Preview Voilation</span>
                            </button>
                <button
                  title="Download Proctoring Violations"
                  onClick={downloadProctoringViolations}
                  disabled={isDownloadingProctoring}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 text-sm"
                >
                  {isDownloadingProctoring ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Camera className="w-3 h-3" />
                  )}
                                    <span className="hidden sm:inline">Proctoring Violations</span>
                </button>
                <button
                  title="Print Report"
                  onClick={printReport}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 text-sm"
                >
                  <Printer className="w-3 h-3" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                <button
                  title="Back to list"
                  onClick={() => navigate(-1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 text-sm"
                >
                  <ArrowLeft className="w-3 h-3" />
                </button>
              </>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Candidate Info */}
              <div className="bg-white border border-blue-100 shadow-sm rounded-lg print:shadow-none">
                <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                                    <p className="text-blue-700 font-semibold text-sm">Candidate Information</p>
                </div>
                <div className="p-4 text-sm space-y-2 text-slate-700">
                  {candidatePhoto && (
                    <div className="mb-4 flex justify-center">
                      <img
                        src={candidatePhoto}
                        alt="Candidate Photo"
                        className="w-32 h-32 object-cover rounded-lg border-2 border-blue-200 shadow-md"
                      />
                    </div>
                  )}
                                    <p><span className="font-medium">Name:</span> {candidate.name}</p>
                                    <p><span className="font-medium">Email:</span> {candidate.email}</p>
                  <p>
                    <span className="font-medium">Status:</span>
                    <span className="ml-2 inline-flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-3 h-3" />
                      Completed
                    </span>
                  </p>
                  <p>
                                        <span className="font-medium">Assessment:</span>{' '}
                    <span
                      className="hover:text-blue-600 hover:underline cursor-pointer"
                                            onClick={() => navigate(`/admin/ai-assessment/${assessment.id}`)}
                      title="View Assessment"
                    >
                      {assessment.title}
                    </span>
                  </p>
                                    <p><span className="font-medium">Role Type:</span> {assessment.role_type.replace(/_/g, ' ')}</p>
                                    <p><span className="font-medium">Experience Level:</span> {assessment.experience_level.replace(/_/g, ' ')}</p>
                                    <p><span className="font-medium">Asigned Date:</span> {formatDate(assessment.start_date)}</p>
                                    <p><span className="font-medium">Due Date:</span> {formatDate(assessment.end_date)}</p>
                                    <p><span className="font-medium">Start Time:</span> {formatDate(reportData.start_time)}</p>
                                    <p><span className="font-medium">End Time:</span> {formatDate(reportData.end_time)}</p>

                  {/* Calculate and display duration */}
                  {reportData.start_time && reportData.end_time && (
                    <p>
                                <span className="font-medium">Duration:</span>{' '}
                      {(() => {
                        const start = new Date(reportData.start_time);
                        const end = new Date(reportData.end_time);
                                const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
                        const hours = Math.floor(durationMinutes / 60);
                        const minutes = durationMinutes % 60;
                        return (
                          <span className="text-slate-600">
                                        {hours > 0 ? `${hours}h ` : ''}{minutes}min
                          </span>
                        );
                      })()}
                    </p>
                  )}
                </div>
              </div>

              {/* Performance Summary */}
              <div className="bg-white border border-purple-100 shadow-sm rounded-lg print:shadow-none">
                <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
                                    <p className="text-purple-700 font-semibold text-sm">Performance Summary</p>
                </div>
                <div className="p-4 text-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Overall Score:</span>
                                        <span className={`font-semibold ${getScoreColor(scores.overall_score)}`}>
                      {scores.overall_score.toFixed(1)}/10
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Technical Score:</span>
                                        <span className={`font-semibold ${getScoreColor(scores.technical_score)}`}>
                      {scores.technical_score.toFixed(1)}/10
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Communication Score:</span>
                                        <span className={`font-semibold ${getScoreColor(scores.communication_score)}`}>
                      {scores.communication_score.toFixed(1)}/10
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                                        <span className="text-slate-600">Problem Solving Score:</span>
                                        <span className={`font-semibold ${getScoreColor(scores.problem_solving_score)}`}>
                      {scores.problem_solving_score.toFixed(1)}/10
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Recommendation:</span>
                    <span className={`font-semibold ${recommendation.color}`}>
                      {recommendation.text}
                    </span>
                  </div>
                </div>
              </div>

              {/* Assessment Statistics */}
              <div className="bg-white border border-purple-100 shadow-sm rounded-lg print:shadow-none">
                <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
                                    <p className="text-purple-700 font-semibold text-sm">Assessment Statistics</p>
                </div>
                <div className="p-4 text-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Total Questions:</span>
                    <span className="font-semibold">{totalQuestions}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Answered:</span>
                                        <span className="font-semibold text-green-600">{answeredQuestions}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Unanswered:</span>
                                        <span className="font-semibold text-red-600">{totalQuestions - answeredQuestions}</span>
                  </div>
                  <div className="flex justify-between items-center">
                                        <span className="text-slate-600">Average Question Score:</span>
                                        <span className={`font-semibold ${getScoreColor(averageScore)}`}>
                      {averageScore.toFixed(1)}/10
                    </span>
                  </div>
                </div>
              </div>

              {/* Proctoring Summary */}
              <div className="bg-white border border-purple-100 shadow-sm rounded-lg print:shadow-none">
                <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
                                    <p className="text-purple-700 font-semibold text-sm">Proctoring Summary</p>
                </div>
                <div className="p-4 text-sm space-y-3">
                  <div className="flex justify-between items-center">
                                        <span className="text-slate-600">Multiple Faces Detected:</span>
                                        <span className={`font-semibold ${reportData.multiple_faces_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {reportData.multiple_faces_count || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Gaze Movement Alerts:</span>
                                        <span className={`font-semibold ${reportData.gaze_violation_count > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {reportData.gaze_violation_count || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Face Not Detected:</span>
                                        <span className={`font-semibold ${reportData.face_not_detected_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {reportData.face_not_detected_count || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                                        <span className="text-slate-600">Total Proctor Warnings:</span>
                                        <span className={`font-semibold ${reportData.total_proctor_warnings > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {reportData.total_proctor_warnings || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Voice Flow Analysis */}
              {/* {hasVoiceAnalysis && (
                                <div className="bg-white border border-cyan-100 shadow-sm rounded-lg print:shadow-none">
                                    <div className="bg-cyan-50 px-4 py-3 border-b border-cyan-100">
                                        <div className="flex items-center gap-2">
                                            <Mic className="w-4 h-4 text-cyan-700" />
                                            <p className="text-cyan-800 font-semibold text-sm">Voice Flow Analysis</p>
                                        </div>
                                    </div>
                                    <div className="p-4 text-sm space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600">Overall Voice Risk:</span>
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${getRiskBadgeColor(voiceRiskLevel)}`}>
                                                {formatRiskLevel(voiceRiskLevel)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600">Risk Score:</span>
                                            <span className="font-semibold text-slate-800">{voiceRiskScore}/100</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600">High-Risk Answers:</span>
                                            <span className={`font-semibold ${(voiceCounts.high || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {voiceCounts.high || 0}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600">Medium-Risk Answers:</span>
                                            <span className={`font-semibold ${(voiceCounts.medium || 0) > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                                                {voiceCounts.medium || 0}
                                            </span>
                                        </div>
                                        {voiceSummary.flagged_questions && voiceSummary.flagged_questions.length > 0 && (
                                            <div>
                                                <p className="text-slate-600 mb-1">Flagged Questions:</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {voiceSummary.flagged_questions.map((questionNumber) => (
                                                        <span key={questionNumber} className="text-xs font-medium text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded border border-cyan-200">
                                                            Q{questionNumber}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )} */}

              {/* Introduction Video */}
              {reportData.introduction_video_url && (
                <div className="bg-white border border-green-100 shadow-sm rounded-lg print:shadow-none">
                  <div className="bg-green-50 px-4 py-3 border-b border-green-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">

                      <Video className="w-4 h-4 text-green-600" />
                                            <p className="text-green-700 font-semibold text-sm">Introduction Video</p>
                    </div>
                    <button
                      title="Play Introduction Video"
                                            onClick={() => setExpandedVideo(expandedVideo === 'intro' ? null : 'intro')}
                      className="flex items-center gap-1 text-green-600 hover:text-green-700 text-sm font-medium"
                    >
                                            {expandedVideo === 'intro' ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-4 h-4" />
                          <span>Play</span>
                        </>
                      )}
                    </button>
                  </div>
                                   {expandedVideo === 'intro' && (
                    <div className="p-4">
                      <InterviewVideoPlayer
                        src={reportData.introduction_video_url}
                        candidateName={candidate.name}
                        accentColor="green"
                                        onDownload={() => downloadVideo(
                            reportData.introduction_video_url,
                            `intro_${candidate.name.replace(/\s+/g, "_")}.mp4`,
                                            'intro'
                                        )}
                                        isDownloading={downloadingType === 'intro'}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Interview Video */}
              {reportData.interview_video_url && (
                                <div id="interview-video-section" className="bg-white border border-blue-100 shadow-sm rounded-lg print:shadow-none">
                  <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-blue-600" />
                                            <p className="text-blue-700 font-semibold text-sm">Full Interview Recording</p>
                    </div>
                    <button
                      title="Play Interview Video"
                                            onClick={() => setExpandedVideo(expandedVideo === 'interview' ? null : 'interview')}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                                            {expandedVideo === 'interview' ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-4 h-4" />
                          <span>Play</span>
                        </>
                      )}
                    </button>
                  </div>
                                   {expandedVideo === 'interview' && (
                    <div className="p-4">
                      <InterviewVideoPlayer
                        src={reportData.interview_video_url}
                        candidateName={candidate.name}
                        accentColor="blue"
                        //questions={questions}
                        questions={questions.map((q) => ({
                          ...q,
                          timestamp_seconds: q.video_timestamp ?? undefined,
                        }))}
                        jumpToTime={jumpToTime}
                        onJumpComplete={() => setJumpToTime(null)}
                        onDownload={() =>
                          downloadVideo(
                            reportData.interview_video_url,
                            `interview_${candidate.name.replace(/\s+/g, "_")}.mp4`,
                                                    'interview'
                                                )}
                                                isDownloading={downloadingType === 'interview'}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Admin Feedback Section (LEFT COLUMN) */}
              <div className="bg-white border border-purple-100 shadow-sm rounded-lg print:shadow-none">
                {/* Header */}
                <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
                  <div className="flex items-center justify-between">
                    <p className="text-purple-700 font-semibold text-sm">
                      Feedback
                    </p>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4">
                  <textarea
                    value={adminFeedback}
                    onChange={(e) => setAdminFeedback(e.target.value)}
                    placeholder="Write admin feedback for candidate interview..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                    rows={4}
                  />

                  {/* Display saved feedback */}
                  {savedFeedbackText && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-xs text-green-700 font-medium mb-1">
                        Your Feedback:
                      </p>
                      <p className="text-sm text-slate-700">
                        {savedFeedbackText}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-3">
                    {/* Clear Button */}
                    <button
                      onClick={async() => {
                        setAdminFeedback("");
                        setSavedFeedbackText("");
                        await patchAdminFeedback({
                          id: Number(id),
                          admin_feedback: "",
                        }).unwrap();
                        
                        // Show side toast for clear
                        setSideToastMessage("Feedback cleared!");
                        setSideToastType("success");
                        setShowSideToast(true);
                      }}
                      className="text-sm text-red-500 hover:text-red-600"
                    >
                      Clear
                    </button>

                    {/* Save Button */}
                    <button
                      onClick={async() => {
                        if (!adminFeedback.trim()) {
                          // Show error side toast
                          setSideToastMessage(" Please write some feedback!");
                          setSideToastType("error");
                          setShowSideToast(true);
                          return;
                        }

                        try {
                          const result = await patchAdminFeedback({
                            id: Number(id),
                            admin_feedback: adminFeedback,
                          }).unwrap();
                          if (result) {

                        // Save to display
                        setSavedFeedbackText(adminFeedback);

                        // Show success side toast (Right side popup)
                        setSideToastMessage(" Feedback saved successfully!");
                        setSideToastType("success");
                        setShowSideToast(true);
                        } else {
                            setSideToastMessage("Failed to save feedback!");
                            setSideToastType("error");
                            setShowSideToast(true);
                          }
                        } catch (error) {
                          setSideToastMessage("Error saving feedback!");
                          setSideToastType("error");
                          setShowSideToast(true);
                        }
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Save Feedback
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN - Questions */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-4 print:shadow-none">
                                <h2 className="text-lg font-semibold text-slate-800 mb-4">Interview Questions & Responses</h2>

                <div className="space-y-3">
                  {questions.map((question) => {
                                        const isExpanded = expandedQuestions.includes(question.question_number);
                                        const isCoding = question.question_type === 'coding';
                    const hasAnswer = isCoding
                                            ? question.answered && (question.code_answer || '').trim() !== ""
                      : question.answered && question.answer_text.trim() !== "";
                    const verification = question.verification;
                    // const voiceAnalysis = question.voice_analysis;
                    // const voiceQuestionRiskScore = getVoiceRiskScore(voiceAnalysis);

                    return (
                      <div
                        key={question.question_number}
                        className="border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                      >
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50"
                          onClick={() =>
                            toggleQuestion(question.question_number)
                          }
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                Q{question.question_number}
                              </span>
                              {reportData.interview_video_url &&
                                typeof question.video_timestamp ===
                                  "number" && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedVideo("interview");
                                      setJumpToTime(question.video_timestamp!);
                                      setTimeout(() => {
                                        document
                                          .getElementById(
                                            "interview-video-section",
                                          )
                                          ?.scrollIntoView({
                                            behavior: "smooth",
                                            block: "start",
                                          });
                                      });
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-600 text-white text-xs font-medium rounded-full hover:bg-slate-700 active:scale-95 transition-all duration-150 shadow-sm"
                                  >
                                    <svg
                                      className="w-3 h-3 fill-white"
                                      viewBox="0 0 24 24"
                                    >
                                      <path d="M8 5v14l11-7z" />
                                    </svg>
                                    Play
                                  </button>
                                )}
                              {isCoding && (
                                <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-300">
                                  Coding
                                </span>
                              )}
                              {/* {voiceAnalysis && (
                                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${getRiskBadgeColor(voiceAnalysis.risk_level)}`}>
                                                                    Voice: {formatRiskLevel(voiceAnalysis.risk_level)}
                                                                </span>
                                                            )} */}
                              {hasAnswer ? (
                                verification ? (
                                                                    <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded border ${getScoreBadgeColor(verification.score)}`}>
                                    Score: {verification.score}/10
                                  </span>
                                ) : (
                                  <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded border border-green-300">
                                    Answered
                                  </span>
                                )
                              ) : (
                                <span className="ml-auto text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-300">
                                  Not Answered
                                </span>
                              )}
                            </div>
                            <div
                              className="text-sm text-slate-800 font-medium prose max-w-none"
                                                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.question_text) }}
                            />
                          </div>
                          <div className="ml-2 flex-shrink-0">
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-slate-200 p-3 bg-slate-50">
                            <div className="mb-4">
                              <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-sm font-semibold text-slate-700">Candidate's Answer:</span>
                                {question.response_time && (
                                  <span className="text-xs text-slate-500">
                                    (Response time: {question.response_time}s)
                                  </span>
                                )}
                              </div>
                              {hasAnswer ? (
                                isCoding ? (
                                  <div className="space-y-3">
                                    {/* Language badge */}
                                    {question.code_language && (
                                      <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                                        {question.code_language}
                                      </span>
                                    )}
                                    {/* Code block */}
                                    <pre className="text-sm text-slate-200 bg-slate-900 p-4 rounded-lg border border-slate-700 overflow-x-auto whitespace-pre-wrap">
                                      <code>{question.code_answer}</code>
                                    </pre>
                                    {/* Test case results */}
                                                                        {question.code_execution_results && question.code_execution_results.length > 0 && (
                                        <div>
                                          <div className="flex items-center justify-between mb-2">
                                                                                    <span className="text-xs font-semibold text-slate-700">Test Cases:</span>
                                            <span className="text-xs font-semibold text-slate-500">
                                                                                        {question.code_marks_earned || 0}/{question.code_marks_total || 0} points
                                            </span>
                                          </div>
                                          <div className="space-y-1">
                                                                                    {question.code_execution_results.map((tc, idx) => (
                                                                                        <div key={idx} className={`flex items-center justify-between p-2 rounded text-xs ${
                                                    tc.passed
                                                                                                ? 'bg-green-50 text-green-700 border border-green-200'
                                                                                                : 'bg-red-50 text-red-700 border border-red-200'
                                                                                        }`}>
                                                  <span className="flex items-center gap-1">
                                                                                                {tc.passed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                                                                Test Case {idx + 1} {tc.is_hidden ? '(Hidden)' : ''}
                                                  </span>
                                                                                            <span>{tc.points || 0} pts</span>
                                                </div>
                                                                                    ))}
                                          </div>
                                        </div>
                                      )}
                                  </div>
                                ) : (
                                  <div className="text-sm text-slate-700 bg-white p-3 rounded border border-slate-200">
                                    {question.answer_text}
                                  </div>
                                )
                              ) : (
                                <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200 flex items-center gap-2">
                                  <XCircle className="w-4 h-4" />
                                  No answer provided
                                </div>
                              )}
                            </div>

                            {verification && (
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                                                    <span className="text-sm font-semibold text-slate-700">Evaluation:</span>
                                                                    <span className={`text-sm font-semibold ${getScoreColor(verification.score)}`}>
                                    Score: {verification.score}/10
                                  </span>
                                </div>

                                {verification.covered.length > 0 && (
                                  <div className="mb-3">
                                                                        <p className="text-xs font-medium text-green-700 mb-1">Points Covered:</p>
                                    <div className="flex flex-wrap gap-1">
                                                                            {verification.covered.map((point, idx) => (
                                                                                <span key={idx} className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">
                                            {point}
                                          </span>
                                                                            ))}
                                    </div>
                                  </div>
                                )}

                                {verification.missing.length > 0 && (
                                  <div className="mb-3">
                                    <p className="text-xs font-medium text-red-700 mb-1">
                                      Points Missing:
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {verification.missing.map(
                                        (point, idx) => (
                                          <span
                                            key={idx}
                                            className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded"
                                          >
                                            {point}
                                          </span>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}

                                {verification.missing.length > 0 && (
                                  <div className="mb-3">
                                                                                    <p className="text-xs font-medium text-red-700 mb-1">Points Missing:</p>                                                <div className="flex flex-wrap gap-1">
                                                                            {verification.missing.map((point, idx) => (
                                                                                <span key={idx} className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded">
                                            {point}
                                          </span>
                                                                            ))}
                                    </div>
                                  </div>
                                )}

                                {verification.reason && (
                                  <div>
                                                                        <p className="text-xs font-medium text-slate-700 mb-1">Feedback:</p>
                                    <p className="text-sm text-slate-600 bg-white p-3 rounded border border-slate-200">
                                      {verification.reason}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                            {/* 
                                                        {voiceAnalysis && (
                                                            <div className="mt-4 border-t border-slate-200 pt-4">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Mic className="w-4 h-4 text-cyan-700" />
                                                                    <span className="text-sm font-semibold text-slate-700">Voice Flow Review:</span>
                                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${getRiskBadgeColor(voiceAnalysis.risk_level)}`}>
                                                                        {formatRiskLevel(voiceAnalysis.risk_level)} - {voiceQuestionRiskScore}/100
                                                                    </span>
                                                                </div>

                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                                                                    <div className="bg-white p-2 rounded border border-slate-200">
                                                                        <p className="text-xs text-slate-500">Speech Rate</p>
                                                                        <p className="text-sm font-semibold text-slate-800">{Math.round(voiceAnalysis.speech_rate_wpm || 0)} wpm</p>
                                                                    </div>
                                                                    <div className="bg-white p-2 rounded border border-slate-200">
                                                                        <p className="text-xs text-slate-500">Long Pauses</p>
                                                                        <p className="text-sm font-semibold text-slate-800">{voiceAnalysis.long_pause_count || 0}</p>
                                                                    </div>
                                                                    <div className="bg-white p-2 rounded border border-slate-200">
                                                                        <p className="text-xs text-slate-500">Longest Pause</p>
                                                                        <p className="text-sm font-semibold text-slate-800">{(voiceAnalysis.longest_pause_seconds || 0).toFixed(1)}s</p>
                                                                    </div>
                                                                    <div className="bg-white p-2 rounded border border-slate-200">
                                                                        <p className="text-xs text-slate-500">Mid-Answer Shift</p>
                                                                        <p className="text-sm font-semibold text-slate-800">{Math.round(voiceAnalysis.mid_answer_shift_score || 0)}/100</p>
                                                                    </div>
                                                                </div>

                                                                {voiceAnalysis.signals && voiceAnalysis.signals.length > 0 && (
                                                                    <div className="mb-3">
                                                                        <p className="text-xs font-medium text-cyan-800 mb-1">Reviewer Signals:</p>
                                                                        <div className="space-y-1">
                                                                            {voiceAnalysis.signals.slice(0, 5).map((signal, idx) => (
                                                                                <div key={idx} className="text-xs text-cyan-900 bg-cyan-50 px-2 py-1 rounded border border-cyan-100">
                                                                                    {signal}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {(voiceAnalysis.llm_review?.reasoning || voiceAnalysis.llm_review?.recommended_reviewer_action) && (
                                                                    <div className="bg-white p-3 rounded border border-slate-200">
                                                                        {voiceAnalysis.llm_review?.reasoning && (
                                                                            <p className="text-sm text-slate-700 mb-2">{voiceAnalysis.llm_review.reasoning}</p>
                                                                        )}
                                                                        {voiceAnalysis.llm_review?.recommended_reviewer_action && (
                                                                            <p className="text-xs font-medium text-slate-600">
                                                                                Reviewer action: {voiceAnalysis.llm_review.recommended_reviewer_action}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )} */}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Side Toast Popup */}
      {showSideToast && (
        <SideToast
          message={sideToastMessage}
          type={sideToastType}
          onClose={() => setShowSideToast(false)}
        />
      )}
{showProctoringPreview && proctoringPdfUrl && (
    <div 
        style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}
        onClick={closeProctoringPreview}
    >
        <div
            style={{
                width: '90vw',
                height: '90vh',
                backgroundColor: 'white',
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header with timestamp info */}
            <div style={{
                padding: '12px 16px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
                    Proctoring Violations - {reportData?.candidate.name}
                </h3>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    Video time (MM:SS) from interview start
                </span>
            </div>
            
            {/* Violations List with Video Timestamp */}
            <div style={{
                padding: '12px 16px',
                backgroundColor: '#f9fafb',
                borderBottom: '1px solid #e5e7eb',
                maxHeight: '250px',
                overflowY: 'auto',
            }}>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ textAlign: 'left', padding: '8px', fontWeight: '600' }}>#</th>
                            <th style={{ textAlign: 'left', padding: '8px', fontWeight: '600' }}>Type</th>
                            <th style={{ textAlign: 'left', padding: '8px', fontWeight: '600' }}>Severity</th>
                            <th style={{ textAlign: 'left', padding: '8px', fontWeight: '600' }}>Video Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData?.cheating_alerts?.filter(a => a.screenshot_url).map((alert, idx) => {
                            // Calculate video time from violation timestamp
                            const violationTime = new Date(alert.timestamp).getTime();
                            const startTime = new Date(reportData.start_time).getTime();
                            let videoSeconds = Math.floor((violationTime - startTime) / 1000);
                            if (videoSeconds < 0) videoSeconds = 0;
                            const mins = Math.floor(videoSeconds / 60);
                            const secs = videoSeconds % 60;
                            const videoTime = `${mins}:${secs.toString().padStart(2, '0')}`;
                            
                            return (
                                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '8px' }}>{idx + 1}</td>
                                    <td style={{ padding: '8px' }}>{alert.type.replace(/_/g, ' ').toUpperCase()}</td>
                                    <td style={{ padding: '8px' }}>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            fontSize: '11px',
                                            fontWeight: '500',
                                            backgroundColor: alert.severity === 'high' ? '#fee2e2' : alert.severity === 'medium' ? '#fef3c7' : '#dcfce7',
                                            color: alert.severity === 'high' ? '#dc2626' : alert.severity === 'medium' ? '#d97706' : '#16a34a',
                                        }}>
                                            {alert.severity.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '8px', fontFamily: 'monospace', color: '#3b82f6' }}>
                                        {videoTime}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            {/* PDF Viewer */}
            <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#f1f5f9', padding: '10px' }}>
                <iframe
                    src={proctoringPdfUrl}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        borderRadius: '8px',
                        backgroundColor: 'white',
                    }}
                    title="Proctoring Report"
                />
            </div>
        </div>
    </div>
                    )}
    </AdminLayout>
  );
};

export default AiAssessmentResultDetails;
