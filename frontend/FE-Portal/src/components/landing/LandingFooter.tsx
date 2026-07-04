import { Link } from "react-router-dom";
import { Send } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/zeclogo.png";
import { footerLinks, socialLinks } from "@/constants/landingData";

export const LandingFooter = () => (
  <footer className="bg-[#030308] text-gray-400 border-t border-white/5">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8">
        <div className="lg:col-span-4">
          <Link to="/" className="flex items-center gap-2.5 mb-5">
            <img src={logo} alt="Skiltechy" className="h-9 w-auto brightness-0 invert" />
            {/* <span className="font-bold text-lg text-white tracking-tight">Skiltechy</span> */}
          </Link>
          <p className="text-sm leading-relaxed text-gray-500 max-w-sm mb-6">
            Empowering learners and teams with curated technical training, AI-powered assessments,
            and interview preparation.
          </p>
          <div className="flex gap-3">
            {socialLinks.map(({ icon: Icon, href, label }) => (
              <motion.a
                key={label}
                href={href}
                whileHover={{ scale: 1.1, y: -2 }}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-violet-500/40 transition-colors"
                aria-label={label}
              >
                <Icon className="h-4 w-4" />
              </motion.a>
            ))}
          </div>
        </div>

        {footerLinks.map((group) => (
          <div key={group.title} className="lg:col-span-2">
            <h4 className="text-white font-semibold text-sm mb-4">{group.title}</h4>
            <ul className="space-y-3">
              {group.links.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("#") ? (
                    <button
                      type="button"
                      onClick={() =>
                        document.querySelector(link.href)?.scrollIntoView({ behavior: "smooth" })
                      }
                      className="text-sm hover:text-white transition-colors"
                    >
                      {link.label}
                    </button>
                  ) : (
                    <Link to={link.href} className="text-sm hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="lg:col-span-4">
          <h4 className="text-white font-semibold text-sm mb-4">Stay in the loop</h4>
          <p className="text-sm text-gray-500 mb-4">
            Get product updates, learning tips, and exclusive offers.
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 min-w-0 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
            />
            <button
              type="submit"
              className="p-3 rounded-2xl bg-violet-600 text-white hover:bg-violet-500 transition-colors shrink-0"
              aria-label="Subscribe"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-white/5 mt-14 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
        <p>© {new Date().getFullYear()} Skiltechy. All rights reserved.</p>
        <div className="flex flex-wrap items-center justify-center gap-6">
          <a href="#" className="hover:text-white transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Terms of Service
          </a>
          <Link to="/login" state={{ role: "candidate" }} className="hover:text-white transition-colors">
            Login
          </Link>
        </div>
      </div>
    </div>
  </footer>
);
