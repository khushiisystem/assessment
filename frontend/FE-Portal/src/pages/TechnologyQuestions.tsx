import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import QuestionManagement from "@/components/QuestionManagement";
import { useLazyGetTechnologyByIdQuery } from "@/store";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

const TechnologyQuestions = () => {
  const { technologyId } = useParams<{ technologyId: string }>();
  const navigate = useNavigate();
  const [technologyName, setTechnologyName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [candidatesData, setCandidatesData] = useState<any[]>([]);
  const [getTechnologyById] = useLazyGetTechnologyByIdQuery();
  useEffect(() => {
    const fetchTechnologyDetails = async () => {
      if (!technologyId) {
        toast({
          title: "Technology not found",
          description: "Missing technology identifier in the URL.",
          variant: "destructive",
          duration: 3000,
        });
        navigate("/admin/technologies", { replace: true });
        return;
      }

      try {
        const data = await getTechnologyById((technologyId)).unwrap();
        setTechnologyName(data?.name ?? "Technology");
        setCandidatesData(data?.candidates ?? []);
      } catch (error) {
        toast({
          title: "Failed to load technology",
          description: "Please try again.",
          variant: "destructive",
          duration: 3000,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTechnologyDetails();
  }, [technologyId, navigate]);

  if (!technologyId) {
    return null;
  }

  return (
    <AdminLayout>
      {isLoading ? (
        <div className="w-full">
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
            <div className="h-11 w-11 animate-spin rounded-full border-2 border-slate-200 border-t-brand-violet" />
            <p className="text-sm text-slate-500">Loading technology…</p>
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="rounded-xl border-slate-200 text-slate-600 hover:border-brand-violet/40 hover:text-brand-violet"
            >
              Go Back
            </Button>
          </div>
        </div>
      ) : (
        <QuestionManagement
          technologyId={technologyId}
          technologyName={technologyName}
          onBack={() => navigate(-1)}
          candidatesData={candidatesData}
        />
      )}
    </AdminLayout>
  );
};

export default TechnologyQuestions;

