import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#080810] flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-5 py-32">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-md"
        >
          <p className="font-mono text-accent-500 text-sm font-semibold mb-4">404</p>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Page not found</h1>
          <p className="text-white/45 mb-10 leading-relaxed">
            This page doesn't exist or has been moved. Head back home and we'll get you sorted.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/" className="btn-primary">
              Go home
            </Link>
            <Link to="/sign-in" className="btn-secondary">
              Sign in
            </Link>
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
