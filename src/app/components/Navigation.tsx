/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { resolveTryGrayUrl } from "@/lib/grayCta";
import { useI18n } from "@/contexts/I18nContext";

const Navigation = () => {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const drawerId = "mobile-navigation";
  const [menuOpen, setMenuOpen] = useState(false);
  const [tryGrayUrl, setTryGrayUrl] = useState(() => resolveTryGrayUrl());
  const grayHref = "/";

  const navLinks = [
    { href: grayHref, label: "GRAY" },
    { href: "/#research", label: "RESEARCH" },
  ] as const;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setTryGrayUrl(resolveTryGrayUrl(window.location.hostname));
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const closeOnClickAway = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }

      if (!containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnClickAway);
    return () => document.removeEventListener("mousedown", closeOnClickAway);
  }, [menuOpen]);

  useEffect(() => {
    const handleResize = () => setMenuOpen(false);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleMenu = () => setMenuOpen((open) => !open);
  const handleNavClick = () => setMenuOpen(false);

  return (
    <div className="nav-shell" ref={containerRef}>
      <div className="nav-backdrop" aria-hidden />
      <nav className="nav-bar">
        <Link href="/" className="nav-logo" onClick={handleNavClick}>
          <span className="sr-only">alignment.id</span>
          <Image
            src="/alignmentlogo.svg"
            alt="alignment.id"
            width={120}
            height={32}
            priority
          />
        </Link>
        <div className="nav-primary">
          <div className="nav-links">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="nav-link"
                onClick={handleNavClick}
                prefetch={false}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <Link
            href={tryGrayUrl}
            className="nav-cta"
            onClick={handleNavClick}
            prefetch={false}
            target="_blank"
            rel="noreferrer"
          >
            <Image
              src="/grayaiwhitenotspinning.svg"
              alt=""
              width={20}
              height={20}
              className="nav-cta__icon"
              aria-hidden
              priority
            />
            <span className="sr-only">{t("Open Gray workspace")}</span>
          </Link>
        </div>
        <button
          type="button"
          className="nav-menu-toggle"
          aria-label={t("Toggle navigation")}
          aria-expanded={menuOpen}
          aria-controls={drawerId}
          onClick={toggleMenu}
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </svg>
        </button>
      </nav>
      <div
        className={`nav-drawer${menuOpen ? " nav-drawer--open" : ""}`}
        id={drawerId}
        aria-hidden={!menuOpen}
      >
        <div className="nav-drawer__content">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="nav-drawer__link"
              onClick={handleNavClick}
              prefetch={false}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={tryGrayUrl}
            className="nav-drawer__cta"
            onClick={handleNavClick}
            prefetch={false}
            target="_blank"
            rel="noreferrer"
          >
            <Image
              src="/grayaiwhitenotspinning.svg"
              alt=""
              width={20}
              height={20}
              className="nav-cta__icon"
              aria-hidden
              priority
            />
            <span className="sr-only">{t("Open Gray workspace")}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Navigation;
