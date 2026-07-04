import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * AdminRoute component that ensures only authenticated admin users can access the route
 * Redirects to login page if not authenticated, or to dashboard if authenticated but not admin
 */
const AdminRoute = ({ children }: AdminRouteProps) => {
  const { isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Save the attempted location so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    // User is authenticated but not an admin, redirect to dashboard
    return <Navigate to="/candidate/dashboard" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;

