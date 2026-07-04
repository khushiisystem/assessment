import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuth();

  const handleGoBack = useCallback(() => {
    // If there is a previous entry in history, try going back
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    // Otherwise, send the user to the appropriate home based on auth/role
    if (isAuthenticated) {
      navigate(isAdmin ? "/admin" : "/candidate/dashboard", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [navigate, isAuthenticated, isAdmin]);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-2xl w-full shadow-soft">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
              <Search className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight mb-3 text-foreground">404</h1>
            <p className="text-lg text-muted-foreground mb-6">We couldn’t find the page you’re looking for.</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleGoBack} className="bg-gradient-primary">
                Go Back
              </Button>
              {isAuthenticated ? (
                <Button variant="secondary" asChild>
                  <Link to={isAdmin ? "/admin" : "/candidate/dashboard"}>
                    Go to {isAdmin ? "Admin" : "Dashboard"}
                  </Link>
                </Button>
              ) : (
                <Button variant="secondary" asChild>
                  <Link to="/">Go to Home</Link>
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-6">Attempted URL: {location.pathname}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
