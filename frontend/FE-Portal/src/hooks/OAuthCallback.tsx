import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { tokenStorage } from "@/lib/tokenStorage";
import { useLazyGoogleCallbackQuery, useAppDispatch, setCredentials } from "@/store";

const OAuthCallback = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();
    const [googleCallback] = useLazyGoogleCallbackQuery();
    const dispatch = useAppDispatch();

    useEffect(() => {
        const handleOAuthCallback = async () => {
            try {
                const code = searchParams.get("code");
                const error = searchParams.get("error");

                if (error) {
                    throw new Error(`OAuth error: ${error}`);
                }

                if (!code) {
                    throw new Error("No authorization code received");
                }

                // Call your backend callback endpoint
                const callbackUrl = `/api/auth/google/callback?code=${encodeURIComponent(code)}`;
                const data = await googleCallback(callbackUrl).unwrap();

                const { access, refresh, user } = data;

                // Store tokens and user data
                if (access) {
                    tokenStorage.setAccessToken(access);
                }
                if (refresh) {
                    tokenStorage.setRefreshToken(refresh);
                }
                tokenStorage.setUser(user);

                // Store auth in Redux
                dispatch(setCredentials({ accessToken: access, refreshToken: refresh, user }));

                // Show success toast
                toast({
                    title: "Login Successful",
                    description: `Welcome back, ${user?.name || user?.email}!`,
                    variant: "success",
                    duration: 3000
                });

                // Redirect to appropriate pages
                const redirectUrl = sessionStorage.getItem("oauth_redirect_url");
                sessionStorage.removeItem("oauth_redirect_url");

                // If there's a saved redirect URL and it's not a neutral page, use it (with permission check)
                if (redirectUrl && redirectUrl !== "/login" && redirectUrl !== "/") {
                    // Staff (super_admin / org_admin / manager) may use admin routes.
                    const isStaff =
                        user?.role === "super_admin" || user?.role === "org_admin" || user?.role === "manager";
                    if (redirectUrl.startsWith("/admin") && !isStaff) {
                        // User tried to access admin route but isn't staff, redirect to dashboard
                        navigate("/candidate/dashboard", { state: { user } });
                    } else {
                        // Redirect to the originally requested page
                        navigate(redirectUrl, { state: { user } });
                    }
                } else {
                    // No redirect location, use role-based redirect
                    if (user?.role === "super_admin" || user?.role === "org_admin" || user?.role === "manager") {
                        navigate("/admin", { state: { user } });
                    } else if (user?.role === "candidate") {
                        navigate("/candidate/dashboard", { state: { user } });
                    } else {
                        navigate("/");
                    }
                }

            } catch (error: any) {
                console.error("OAuth Callback Error:", error);

                toast({
                    title: "Login Failed",
                    description: error.data?.detail || error.message || "Authentication failed",
                    variant: "destructive",
                    duration: 3000
                });

                navigate("/login");
            }
        };

        handleOAuthCallback();
    }, [searchParams, navigate, toast]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-lg">Completing authentication...</p>
            </div>
        </div>
    );
};

export default OAuthCallback;
