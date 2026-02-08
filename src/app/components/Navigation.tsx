"use client";

import Image from "next/image";
import Link from "next/link";
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDismissableLayer } from "@/components/gray/hooks/useDismissableLayer";
import { useHasHydrated } from "@/components/gray/hooks/useHasHydrated";
import { resolveTryGrayUrl } from "@/lib/grayCta";
import { useI18n } from "@/contexts/I18nContext";

type NavigationProps = {
  defaultHidden?: boolean;
};

const Navigation = ({ defaultHidden = false }: NavigationProps) => {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerId = "mobile-navigation";
  const [menuOpen, setMenuOpen] = useState(false);
  const [navHidden, setNavHidden] = useState(defaultHidden);
  const hasHydrated = useHasHydrated();
  const tryGrayUrl = useMemo(() => {
    if (!hasHydrated) {
      return resolveTryGrayUrl();
    }
    return resolveTryGrayUrl(window.location.hostname);
  }, [hasHydrated]);
  const grayHref = "/gray";
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const showNav = useCallback(() => setNavHidden(false), []);
  const navTabIndex = navHidden ? -1 : undefined;

  const navLinks = [
    { href: grayHref, label: "GRAY" },
    { href: "/#research", label: "RESEARCH" },
  ] as const;
  const dismissRefs = useMemo(() => [containerRef], []);

  useDismissableLayer({
    isOpen: menuOpen,
    ignoreRefs: dismissRefs,
    onDismiss: closeMenu,
    focusTrapRef: drawerRef,
    returnFocusRef: menuToggleRef,
  });

  useEffect(() => {
    const handleResize = () => closeMenu();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [closeMenu]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const toggleMenu = () => setMenuOpen((open) => !open);
  const handleNavBarClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (menuOpen) return;
      const target = event.target as HTMLElement;
      if (target.closest("a, button")) return;
      setNavHidden(true);
    },
    [menuOpen]
  );
  const handleNavClick = closeMenu;

  return (
    <div className={`nav-shell${navHidden ? " nav-shell--hidden" : ""}`} ref={containerRef}>
      <div className="nav-backdrop" aria-hidden />
      <button
        type="button"
        className="nav-reveal"
        onClick={showNav}
        tabIndex={navHidden ? 0 : -1}
        aria-hidden={!navHidden}
        aria-label={t("Show navigation")}
      />
      <nav className="nav-bar" onClick={handleNavBarClick} aria-hidden={navHidden ? "true" : undefined}>
        <Link href="/" className="nav-logo" onClick={handleNavClick} tabIndex={navTabIndex}>
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
                tabIndex={navTabIndex}
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
            tabIndex={navTabIndex}
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
          ref={menuToggleRef}
          aria-label={t("Toggle navigation")}
          aria-expanded={menuOpen}
          aria-controls={drawerId}
          tabIndex={navTabIndex}
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
        ref={drawerRef}
        aria-hidden={!menuOpen}
        role="dialog"
        aria-modal={menuOpen ? "true" : undefined}
        aria-label={t("Navigation menu")}
        tabIndex={-1}
        hidden={!menuOpen}
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
