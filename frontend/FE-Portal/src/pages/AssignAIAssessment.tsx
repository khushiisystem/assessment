import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Mail, ArrowLeft, Users, Info, HelpCircle, Send, Loader2, CheckCircle } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useLazyGetAiAssessmentByIdQuery, useLazyGetCandidatesQuery, useAssignAiAssessmentMutation } from '@/store';

export default function AssignAIAssessment() {
    const [resumeText, setResumeText] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCandidates, setSelectedCandidates] = useState<number[]>([]);
    const [assignedCandidateIds, setAssignedCandidateIds] = useState<number[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [nextPage, setNextPage] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [totalCandidates, setTotalCandidates] = useState(0);
    const { toast } = useToast();
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const [assessment, setAssessment] = useState<any>(null);

    const [getAiAssessment] = useLazyGetAiAssessmentByIdQuery();
    const [getCandidates] = useLazyGetCandidatesQuery();
    const [assignAiAssessment] = useAssignAiAssessmentMutation();

    // Fetch already-assigned candidates for this AI assessment
    useEffect(() => {
        const fetchAssignedCandidates = async () => {
            try {
                const data = await getAiAssessment(Number(id)).unwrap();

                setAssessment(data.assessment);

                const assigned = data.assigned_candidates || [];
                const ids = assigned.map((item: any) =>
                    typeof item.candidate === 'number' ? item.candidate : (item.candidate?.id || item.candidate_id)
                ).filter(Boolean);
                setAssignedCandidateIds(ids);
            } catch (error) {
                console.error("Error fetching assigned candidates:", error);
            }
        };
        if (id) fetchAssignedCandidates();
    }, [id]);

    // Fetch candidates with pagination
    const fetchCandidates = useCallback(async (url?: string, isSearch = false) => {
        if (isLoading) return;

        setIsLoading(true);
        try {
            const endpoint = url || "/my-admin/candidates/";
            const data = await getCandidates(endpoint).unwrap();

            if (isSearch || !url) {
                setCandidates(data.results?.candidates || []);
            } else {
                setCandidates(prev => [...prev, ...(data.results?.candidates || [])]);
            }

            setNextPage(data.next);
            setHasMore(!!data.next);
            setTotalCandidates(data.count || 0);
        } catch (error) {
            console.error("Error fetching candidates:", error);
            toast({
                title: "Network Error",
                description: "Unable to fetch candidates. Please try again later.",
                variant: "destructive",
                duration: 3000,
            });
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, toast]);

    // Initial load
    useEffect(() => {
        fetchCandidates();
    }, []);

    // Handle scroll for infinite loading
    useEffect(() => {
        const container = tableContainerRef.current;
        if (!container || !hasMore || isLoading) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            if (scrollHeight - scrollTop <= clientHeight * 1.5) {
                if (nextPage && !searchQuery.trim()) {
                    fetchCandidates(nextPage);
                }
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [hasMore, isLoading, nextPage, fetchCandidates, searchQuery]);

    // Handle search with debounce
    useEffect(() => {

        const debounceTimer = setTimeout(() => {
            if(!searchQuery.trim()) {
                fetchCandidates();
                return;
            }else{
                fetchCandidates(`/my-admin/candidates/?search=${encodeURIComponent(searchQuery.trim())}`, true);
            }
        }, 500);

        return () => clearTimeout(debounceTimer);
    }, [searchQuery]);

    // const filteredCandidates = candidates.filter(candidate => {
    //     if (!searchQuery.trim()) return true;

    //     const query = searchQuery.toLowerCase();
    //     const fullName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.toLowerCase();
    //     return (
    //         fullName.includes(query) ||
    //         candidate.email.toLowerCase().includes(query) ||
    //         candidate.profile?.toLowerCase().includes(query) ||
    //         candidate.phone?.includes(query)
    //     );
    // });
    const handleSelectCandidate = (candidateId: number) => {
        if (assignedCandidateIds.includes(candidateId)) {
            toast({
                title: "Already Assigned",
                description: "This candidate is already assigned to this assessment.",
                variant: "default",
                duration: 3000,
            });
            return;
        }
        setSelectedCandidates(prev =>
            prev.includes(candidateId)
                ? prev.filter(id => id !== candidateId)
                : [...prev, candidateId]
        );
    };
    const handleSelectAll = () => {
        const selectableCandidates = candidates.filter(c => !assignedCandidateIds.includes(c.id));
        if (selectedCandidates.length === selectableCandidates.length) {
            setSelectedCandidates([]);
        } else {
            setSelectedCandidates(selectableCandidates.map(candidate => candidate.id));
        }
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (selectedCandidates.length === 0) {
            toast({
                title: "No candidates selected",
                description: "Please select at least one candidate.",
                variant: "destructive",
                duration: 3000,
            });
            return;
        }

        if (!resumeText.trim()) {
            toast({
                title: "Resume text required",
                description: "Please enter resume/tech stack details.",
                variant: "destructive",
                duration: 3000,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const data = await assignAiAssessment({
                id: Number(id),
                data: {
                    candidate_ids: selectedCandidates,
                    resume_text: resumeText
                }
            }).unwrap();

            toast({
                title: "Success",
                description: `Assessment assigned to ${data.assigned?.length || selectedCandidates.length} candidate(s)`,
                variant: "success",
                duration: 5000,
            });

            // Reset form after successful assignment
            setTimeout(() => {
                setSelectedCandidates([]);
                setResumeText('');
                navigate(`/admin/assessments`, {
             state: { refresh: true, AssessmentType: "ai" }
            });
            }, 1000);

        } catch (error: any) {

            let errorMessage = "Failed to assign assessment. Please try again.";

            if (error.data?.detail) {
                errorMessage = error.data.detail;
            } else if (error.data?.message) {
                errorMessage = error.data.message;
            } else if (error.data) {
                const fieldErrors = Object.entries(error.data)
                    .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
                    .join('\n');

                if (fieldErrors) {
                    errorMessage = fieldErrors;
                }
            }

            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
                duration: 5000,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Get selected candidate details
    const selectedCandidateDetails = candidates.filter(candidate =>
        selectedCandidates.includes(candidate.id)
    );

    const handleClearAll = () => {
        setSelectedCandidates([]);
        setResumeText('');
    };

    return (
        <AdminLayout>
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="max-w-9xl mx-auto">
                    <PageHeader
                        title="Assign AI Assessment"
                        description="Assign AI-generated assessment to candidates based on their resume/tech stack"
                        className="mb-6"
                        actions={
                          <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigate("/admin/assessments", { state: {  AssessmentType: "ai",}, }) }
                                title="Back"
                                className="flex items-center gap-1 px-2 py-0.5 border border-gray-500 rounded hover:bg-gray-300 transition-all duration-200 text-xs"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                          </div>
                        }
                    />

                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Left Column - AI Assessment Details */}
                            <div className="lg:col-span-2 space-y-8">
                                {/* AI Assessment Card */}
                                <Card className="text-sm bg-blue-100">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-sm">
                                            AI Assessment Details
                                        </CardTitle>

                                    </CardHeader>

                                    <CardContent className="space-y-2">
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700">
                                            <div className="flex gap-2">
                                                <span className="font-medium">Profile:</span>
                                                <span>{assessment?.role_type || "N/A"}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className="font-medium">Experience Level:</span>
                                                <span>{assessment?.experience_level || "N/A"}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className="font-medium">Duration:</span>
                                                <span> {assessment?.num_questions? assessment.num_questions * 2 + " minutes": "N/A"}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className="font-medium">Questions:</span>
                                                <span>{assessment?.num_questions || "N/A"} questions</span>
                                            </div>
                                        </div>


                                        <Separator />

                                        {/* Assignment Details */}
                                        <div className="space-y-2">
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <Label className="text-xs font-medium text-gray-700">
                                                        Resume/Tech Stack *
                                                    </Label>
                                                </div>
                                                <Textarea
                                                    value={resumeText}
                                                    onChange={(e) => setResumeText(e.target.value)}
                                                    placeholder={`Enter candidate resume/tech stack for AI question generation...
Example:
Python, JavaScript, React, Node.js, 3 years experience in web development, worked on e-commerce platforms, familiar with AWS, Docker, MongoDB...`}
                                                    className="min-h-[90px] text-xs placeholder:text-xs"
                                                    required
                                                />
                                                <p className="text-xxs text-gray-500 mt-1">
                                                    {/* Optional help text */}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>


                                {/* Candidates Selection Card */}
                                <Card className="text-xs"> {/* Base font size smaller */}
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle className="flex items-center gap-2 text-sm">
                                                    <Users className="w-4 h-4" />
                                                    Select Candidates
                                                </CardTitle>
                                                <CardDescription className="text-xs text-gray-500">
                                                    Choose candidates to assign this AI assessment
                                                </CardDescription>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="relative">
                                                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                                                    <Input
                                                        placeholder="Search candidates..."
                                                        className="pl-8 w-56 text-xs h-7"
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                    />
                                                </div>

                                            </div>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="p-2">
                                        <div
                                            ref={tableContainerRef}
                                            className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto"
                                        >
                                            {candidates.length > 0 ? (
                                                <Table className="text-xs">
                                                    <TableHeader>
                                                        <TableRow className="h-8">
                                                            <TableHead className="w-8">
                                                                <Checkbox
                                                                    checked={
                                                                        candidates.filter(c => !assignedCandidateIds.includes(c.id)).length > 0 &&
                                                                        selectedCandidates.length === candidates.filter(c => !assignedCandidateIds.includes(c.id)).length
                                                                    }
                                                                    onCheckedChange={handleSelectAll}
                                                                />
                                                            </TableHead>
                                                            <TableHead className="text-xs">Candidate</TableHead>
                                                            <TableHead className="text-xs">Profile</TableHead>
                                                            <TableHead className="text-xs">Phone</TableHead>
                                                            {/* <TableHead className="text-xs">Skills</TableHead> */}
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {candidates.map((candidate) => {
                                                            const isAlreadyAssigned = assignedCandidateIds.includes(candidate.id);
                                                            const isSelected = selectedCandidates.includes(candidate.id);
                                                            return (
                                                            <TableRow
                                                                key={candidate.id}
                                                                className={`h-8 ${
                                                                    isAlreadyAssigned
                                                                        ? 'bg-green-50 opacity-80'
                                                                        : isSelected
                                                                        ? 'bg-blue-50 border-l-2 border-l-blue-500'
                                                                        : ''
                                                                }`}
                                                            >
                                                                <TableCell>
                                                                    {isAlreadyAssigned ? (
                                                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                                                    ) : (
                                                                        <Checkbox
                                                                            checked={selectedCandidates.includes(candidate.id)}
                                                                            onCheckedChange={() => handleSelectCandidate(candidate.id)}
                                                                        />
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span
                                                                                className="font-medium text-gray-900 text-xs hover:text-blue-600 hover:underline cursor-pointer"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    navigate(`/admin/learner/${candidate.id}`);
                                                                                }}
                                                                            >
                                                                                {candidate.first_name} {candidate.last_name}
                                                                            </span>
                                                                            {isAlreadyAssigned && (
                                                                                <span className="px-1 py-0.5 text-[9px] bg-green-100 text-green-800 rounded">
                                                                                    Already Assigned
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                                                            <Mail className="w-3 h-3" />
                                                                            {candidate.email}
                                                                        </div>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-xs">{candidate.profile || 'NA'}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <span className="text-xs">{candidate.phone || 'NA'}</span>
                                                                </TableCell>

                                                            </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            ) : (
                                               <div className="text-center py-6">
                                                    {searchQuery.trim() ? (
                                                        <>
                                                            <Search className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                                            <h3 className="text-sm font-medium text-gray-900 mb-1">
                                                                No candidates found for "{searchQuery}"
                                                            </h3>
                                                            <p className="text-xs text-gray-500">Try a different search term</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                                            <h3 className="text-sm font-medium text-gray-900 mb-1">
                                                                No candidates available
                                                            </h3>
                                                            <p className="text-xs text-gray-500">Add candidates to get started</p>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {isLoading && (
                                                <div className="flex justify-center py-2 text-xs text-gray-600">
                                                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin mr-1" />
                                                    Loading more candidates...
                                                </div>
                                            )}

                                            {!hasMore && candidates.length > 20 && (
                                                <div className="text-center py-2 text-xs text-slate-500 border-t">
                                                    All {totalCandidates} candidates loaded
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>

                                    <CardFooter className="border-t px-4 py-2 text-xs">
                                        <div className="flex items-center justify-between w-full gap-2">
                                            <div className="text-gray-600">
                                                {selectedCandidates.length} candidate(s) selected out of {totalCandidates} total
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={handleClearAll}
                                                    className="h-8 w-32 text-[11px] px-3 py-1 flex items-center justify-center"
                                                >
                                                    <X className="w-3 h-3 mr-1" />
                                                    Clear All
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={isSubmitting || selectedCandidates.length === 0}
                                                    className="h-8 w-32 text-[11px] px-3 py-1 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center"
                                                >
                                                    {isSubmitting ? (
                                                        <div className="flex items-center">
                                                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                                                            Assigning...
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center">
                                                            <Send className="w-3 h-3 mr-1" />
                                                            Assign Assessment
                                                        </div>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardFooter>
                                </Card>

                            </div>

                            {/* Right Column - Assignment Info */}
                            <div className="space-y-2">
                                <div className="bg-white rounded shadow-sm border border-gray-200">
                                    <div className="p-4">
                                        <h2 className="text-sm font-semibold mb-3 text-slate-800 flex items-center gap-1">
                                            <HelpCircle className="w-3.5 h-3.5 text-green-600" />
                                            Assignment Process
                                        </h2>

                                        <div className="space-y-3">
                                            <div className="bg-green-50 border border-green-200 p-3 rounded">
                                                <ul className="list-disc pl-4 text-xs space-y-0.5 text-slate-700">
                                                    <li>Enter candidate's resume or tech stack details</li>
                                                    <li>Select candidates to assign this assessment</li>
                                                    <li>AI will generate personalized questions based on the resume</li>
                                                    <li>Email notifications will be sent to selected candidates</li>
                                                </ul>
                                            </div>

                                            <h2 className="text-sm font-semibold mb-3 text-slate-800 flex items-center gap-1">
                                                <Info className="w-3.5 h-3.5 text-green-600" />
                                                Resume/Tech Stack Tips
                                            </h2>

                                            <div className="bg-blue-50 border border-blue-200 p-3 rounded">

                                                <ul className="list-disc pl-4 text-xs space-y-0.5 text-slate-700">
                                                    <li>Include programming languages and frameworks</li>
                                                    <li>Mention years of experience</li>
                                                    <li>Add specific technologies used</li>
                                                    <li>Include project types or domains</li>
                                                    <li>Be specific for better AI question generation</li>
                                                </ul>
                                            </div>


                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </AdminLayout>
    );
}
