import React, { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Lenis from "lenis";
import { AnimatePresence, motion } from "motion/react";
import NavBar from "./NavBar";
import { Analytics } from "@vercel/analytics/next"
import Footer from "./Footer";
import CursorManager from "./CursorManager";

const Layout = () => {
  const location = useLocation();
  const footerRef = useRef(null);

  // --- Smooth scrolling (Lenis)
  const lenisRef = useRef(null);
  
  useEffect(() => {
    const lenis = new Lenis({
      duration: 2,
      smoothWheel: true,
      smoothTouch: false,
    });
    
    lenisRef.current = lenis;

    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, []);

  // Scroll to top on route change (works with Lenis)
  useEffect(() => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    }
    // Also use standard scroll as fallback
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  return (
    <div className="app">
      <CursorManager />
      <Analytics />
      {/* MAIN APP CONTENT */}
      <NavBar />
      <motion.main
        className="main-content"
        key={location.pathname}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <Outlet />
      </motion.main>
      <footer ref={footerRef} className="animated-footer">
        <Footer />
      </footer>
    </div>
  );
};

export default Layout;
