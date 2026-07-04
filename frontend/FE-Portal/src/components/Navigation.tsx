import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu, X, BookOpen, LayoutDashboard, Users, Settings, LogOut, User } from "lucide-react";
import { clearSession } from "@/lib/clearSession";
import  logo  from '../zeclogo.png'; 

interface NavigationProps {
  role?: "admin" | "employee";
  userName?: string;
}

const Navigation = ({ role, userName }: NavigationProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Get user data from sessionStorage
  const userData = JSON.parse(sessionStorage.getItem("user") || "{}");
  
  // Use props if provided, otherwise fall back to sessionStorage data
  const userRole = role || userData?.role || "employee";
  const userNameFromData = userName || userData?.name || "User";
  const userEmail = userData?.email || "";

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    navigate("/", { replace: true });
    clearSession();
  };

  // Get initials from name
  const getInitials = (name: string) => {
    if (!name || name === "User") return "US";
    
    const words = name.trim().split(" ");
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const adminLinks = [
    { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { path: "/admin/content", label: "Content", icon: BookOpen },
    { path: "/admin/users", label: "Users", icon: Users },
    { path: "/admin/settings", label: "Settings", icon: Settings },
  ];

  const employeeLinks = [
    { path: "/dashboard", label: "My Learning", icon: BookOpen },
    { path: "/progress", label: "Progress", icon: LayoutDashboard },
  ];

  const links = userRole === "admin" ? adminLinks : employeeLinks;

  return (
    <nav className="bg-primary shadow-medium sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img 
              src={ logo }
              alt="Logo" 
              className="h-10 w-auto"
            />
            <span className="text-primary-foreground font-semibold text-lg hidden sm:inline">
              Learning Platform
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link key={link.path} to={link.path}>
                <Button
                  variant="ghost"
                  className={`text-primary-foreground hover:bg-primary-light ${
                    isActive(link.path) ? "bg-primary-light" : ""
                  }`}
                >
                  <link.icon className="h-4 w-4 mr-2" />
                  {link.label}
                </Button>
              </Link>
            ))}
            
            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="ml-2 h-10 w-10 rounded-full p-0 hover:bg-primary-light"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary-light text-primary-foreground font-semibold">
                      {getInitials(userNameFromData)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{userNameFromData}</p>
                    <p className="text-xs text-muted-foreground">
                      {userEmail}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {userRole}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="cursor-pointer text-red-600 focus:text-red-600"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-primary-foreground"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-2 animate-slide-up">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button
                  variant="ghost"
                  className={`w-full justify-start text-primary-foreground hover:bg-primary-light ${
                    isActive(link.path) ? "bg-primary-light" : ""
                  }`}
                >
                  <link.icon className="h-4 w-4 mr-2" />
                  {link.label}
                </Button>
              </Link>
            ))}
            <Link to="/profile" onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant="ghost"
                className="w-full justify-start text-primary-foreground hover:bg-primary-light"
              >
                <User className="h-4 w-4 mr-2" />
                Profile
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-start text-primary-foreground hover:bg-primary-light text-red-600"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
