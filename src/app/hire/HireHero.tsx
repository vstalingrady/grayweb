"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";

type Particle = {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  size: number;
  life: number;
  glitterPhase: number;
};

type HireRole = "" | "cto" | "cmo";

type HireFormState = {
  role: HireRole;
  name: string;
  email: string;
  location: string;
  university: string;
  majorField: string;
  linkedin: string;
  socials: string;
  github: string;
  ctoHardest: string;
  ctoStack: string;
  ctoEquity: string;
  cmoBuilt: string;
  cmoPlan: string;
  cmoTake: string;
  cmoEquity: string;
  interest: string;
  alignmentVision: string;
  studiesBalance: string;
};

type FormStatus = {
  type: "idle" | "submitting" | "success" | "error";
  message?: string;
};

const BASE_PARTICLE_COUNT = 8000;
const MAX_DISTANCE = 240;

const WORD_LIMITS = {
  ctoHardest: 150,
  ctoStack: 150,
  ctoEquity: 100,
  cmoPlan: 150,
  cmoTake: 100,
  cmoEquity: 100,
  interest: 100,
  alignmentVision: 100,
  studiesBalance: 100,
};

const countWords = (value: string) => {
  if (!value) return 0;
  return value.trim().split(/\s+/).filter(Boolean).length;
};

const clampToWordLimit = (value: string, limit: number) => {
  if (!value) return value;
  const matches = Array.from(value.matchAll(/\S+/g));
  if (matches.length <= limit) return value;
  const lastMatch = matches[limit - 1];
  const endIndex = (lastMatch.index ?? 0) + lastMatch[0].length;
  return value.slice(0, endIndex);
};

export default function HireHero() {
  const router = useRouter();
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moonImageRef = useRef<HTMLImageElement | null>(null);
  const moonPlacementRef = useRef({ x: 0, y: 0, size: 0 });
  const logoParallaxRef = useRef(0);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const isTouchingRef = useRef(false);
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const isMobileRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const turnstileRef = useRef<TurnstileInstance>();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  const shouldUseCaptcha = Boolean(turnstileSiteKey);

  const [formState, setFormState] = useState<HireFormState>({
    role: "",
    name: "",
    email: "",
    location: "",
    university: "",
    majorField: "",
    linkedin: "",
    socials: "",
    github: "",
    ctoHardest: "",
    ctoStack: "",
    ctoEquity: "",
    cmoBuilt: "",
    cmoPlan: "",
    cmoTake: "",
    cmoEquity: "",
    interest: "",
    alignmentVision: "",
    studiesBalance: "",
  });
  const [formStatus, setFormStatus] = useState<FormStatus>({ type: "idle" });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: Particle[] = [];
    let logoImageData: ImageData | null = null;
    let animationFrameId: number | null = null;
    let isAlive = true;

    const logoImage = new Image();
    logoImage.src = "/alignmentlogowhite.svg";
    logoImage.onload = () => {
      if (!isAlive) return;
      logoImageRef.current = logoImage;
      initializeScene();
    };

    const moonImage = new Image();
    moonImage.src = "/moon.jpg";
    moonImage.onload = () => {
      if (!isAlive) return;
      moonImageRef.current = moonImage;
    };

    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      isMobileRef.current = window.innerWidth < 768;
    };

    const createLogoImage = () => {
      if (!logoImageRef.current) return;
      const logo = logoImageRef.current;
      const logoWidth = logo.naturalWidth || logo.width || 1;
      const logoHeight = logo.naturalHeight || logo.height || 1;
      const maxWidth = canvas.width * (isMobileRef.current ? 1.0 : 0.6);
      const topPad = canvas.height * (isMobileRef.current ? 0.14 : 0.18);
      const maxHeight = Math.max(canvas.height - topPad, canvas.height * 0.7);
      const scale = Math.min(maxWidth / logoWidth, maxHeight / logoHeight);
      const drawWidth = logoWidth * scale;
      const drawHeight = logoHeight * scale;
      const x = (canvas.width - drawWidth) / 2;
      const y = Math.min(topPad + Math.max((maxHeight - drawHeight) * 0.08, 0), canvas.height - drawHeight);
      const moonOffset = drawHeight * (isMobileRef.current ? 0.12 : 0.1);
      const moonY = Math.max(drawHeight * 0.08, y - moonOffset);
      moonPlacementRef.current = {
        x: canvas.width * 0.5,
        y: moonY,
        size: drawWidth * (isMobileRef.current ? 0.12 : 0.09),
      };
      if (contentRef.current) {
        const logoBottom = y + drawHeight;
        contentRef.current.style.setProperty("--logo-bottom", `${logoBottom}px`);
        sectionRef.current?.style.setProperty("--logo-bottom", `${logoBottom}px`);
      }
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(logo, x, y, drawWidth, drawHeight);
      logoImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    };

    const createParticle = (): Particle | null => {
      if (!logoImageData) return null;
      const data = logoImageData.data;

      for (let attempt = 0; attempt < 100; attempt++) {
        const x = Math.floor(Math.random() * canvas.width);
        const y = Math.floor(Math.random() * canvas.height);

        if (data[(y * canvas.width + x) * 4 + 3] > 128) {
          return {
            x,
            y,
            baseX: x,
            baseY: y,
            size: Math.random() * 1.5 + 0.5,
            glitterPhase: Math.random() * Math.PI * 2,
            life: Math.random() * 100 + 50,
          };
        }
      }

      return null;
    };

    const createInitialParticles = () => {
      const particleCount = Math.floor(
        BASE_PARTICLE_COUNT * Math.sqrt((canvas.width * canvas.height) / (1920 * 1080))
      );
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        const particle = createParticle();
        if (particle) particles.push(particle);
      }
    };


    const drawBackdrop = () => {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackdrop();

      const moon = moonImageRef.current;
      const { x: moonX, y: moonY, size: moonSize } = moonPlacementRef.current;
      if (moon && moonSize > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(moon, moonX - moonSize / 2, moonY - moonSize / 2, moonSize, moonSize);
        ctx.restore();
      }

      const { x: mouseX, y: mouseY } = mousePositionRef.current;
      const logoOffset = logoParallaxRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = mouseX - p.x;
        const renderY = p.y + logoOffset;
        const dy = mouseY - renderY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        p.glitterPhase += 0.1;

        if (distance < MAX_DISTANCE && (isTouchingRef.current || !("ontouchstart" in window))) {
          const force = (MAX_DISTANCE - distance) / MAX_DISTANCE;
          const angle = Math.atan2(dy, dx);
          const moveX = Math.cos(angle) * force * 60;
          const moveY = Math.sin(angle) * force * 60;
          p.x = p.baseX - moveX;
          p.y = p.baseY - moveY;

          const glitterIntensity = (Math.sin(p.glitterPhase) + 1) / 2;
          const whiteIntensity = Math.floor(200 + glitterIntensity * 55);
          ctx.fillStyle = `rgb(${whiteIntensity}, ${whiteIntensity}, ${whiteIntensity})`;
        } else {
          p.x += (p.baseX - p.x) * 0.1;
          p.y += (p.baseY - p.y) * 0.1;
          ctx.fillStyle = "white";
        }

        ctx.fillRect(p.x, renderY, p.size, p.size);

        p.life--;
        if (p.life <= 0) {
          const newParticle = createParticle();
          if (newParticle) {
            particles[i] = newParticle;
          } else {
            particles.splice(i, 1);
            i--;
          }
        }
      }

      const targetParticleCount = Math.floor(
        BASE_PARTICLE_COUNT * Math.sqrt((canvas.width * canvas.height) / (1920 * 1080))
      );
      while (particles.length < targetParticleCount) {
        const newParticle = createParticle();
        if (newParticle) particles.push(newParticle);
        else break;
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    const initializeScene = () => {
      updateCanvasSize();
      createLogoImage();
      createInitialParticles();
      if (animationFrameId === null) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    const handleResize = () => {
      updateCanvasSize();
      if (!logoImageRef.current) return;
      createLogoImage();
      createInitialParticles();
    };

    const handleMove = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      mousePositionRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    };

    const handleMouseMove = (event: MouseEvent) => {
      handleMove(event.clientX, event.clientY);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        const touch = event.touches[0];
        handleMove(touch.clientX, touch.clientY);
      }
    };

    const handleTouchStart = () => {
      isTouchingRef.current = true;
    };

    const handleTouchEnd = () => {
      isTouchingRef.current = false;
      mousePositionRef.current = { x: 0, y: 0 };
    };

    const handleMouseLeave = () => {
      if (!("ontouchstart" in window)) {
        mousePositionRef.current = { x: 0, y: 0 };
      }
    };

    updateCanvasSize();

    window.addEventListener("resize", handleResize);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("touchstart", handleTouchStart);
    canvas.addEventListener("touchend", handleTouchEnd);

    return () => {
      isAlive = false;
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchend", handleTouchEnd);
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let parallaxFrameId: number | null = null;
    const state = {
      logoOffset: 0,
      logoTarget: 0,
    };

    const updateTargets = () => {
      const maxLogoOffset = window.innerHeight * 0.2;
      const scrollY = Math.max(window.scrollY, 0);
      state.logoTarget = Math.min(scrollY * 0.18, maxLogoOffset);
    };

    const step = () => {
      const ease = 0.08;
      state.logoOffset += (state.logoTarget - state.logoOffset) * ease;

      logoParallaxRef.current = state.logoOffset;

      const logoDelta = Math.abs(state.logoTarget - state.logoOffset);
      if (logoDelta > 0.1) {
        parallaxFrameId = window.requestAnimationFrame(step);
      } else {
        parallaxFrameId = null;
      }
    };

    const kick = () => {
      updateTargets();
      if (parallaxFrameId === null) {
        parallaxFrameId = window.requestAnimationFrame(step);
      }
    };

    kick();
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);

    return () => {
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      if (parallaxFrameId !== null) {
        cancelAnimationFrame(parallaxFrameId);
      }
    };
  }, []);

  const updateField =
    (key: keyof HireFormState) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        let value = event.target.value as HireFormState[typeof key];
        if (typeof value === "string" && key in WORD_LIMITS) {
          const wordLimit = WORD_LIMITS[key as keyof typeof WORD_LIMITS];
          value = clampToWordLimit(value, wordLimit) as HireFormState[typeof key];
        }
        if (formStatus.type === "error" || formStatus.type === "success") {
          setFormStatus({ type: "idle" });
        }
        setFormState((prev) => ({ ...prev, [key]: value }));
      };

  const handleResumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (formStatus.type === "error" || formStatus.type === "success") {
      setFormStatus({ type: "idle" });
    }
    const file = event.target.files?.[0] ?? null;
    setResumeFile(file);
  };

  const resetCaptcha = () => {
    setCaptchaToken(null);
    if (turnstileRef.current) {
      turnstileRef.current.reset();
    }
  };

  const wordLimitError = () => {
    if (countWords(formState.interest) > WORD_LIMITS.interest) {
      return "Interest question exceeds 100 words.";
    }
    if (countWords(formState.alignmentVision) > WORD_LIMITS.alignmentVision) {
      return "Vision question exceeds 100 words.";
    }
    if (countWords(formState.studiesBalance) > WORD_LIMITS.studiesBalance) {
      return "Studies balance question exceeds 100 words.";
    }
    if (formState.role === "cto") {
      if (countWords(formState.ctoHardest) > WORD_LIMITS.ctoHardest) {
        return "CTO hardest build exceeds 150 words.";
      }
      if (countWords(formState.ctoStack) > WORD_LIMITS.ctoStack) {
        return "CTO tech stack exceeds 150 words.";
      }
      if (countWords(formState.ctoEquity) > WORD_LIMITS.ctoEquity) {
        return "CTO equity question exceeds 100 words.";
      }
    }
    if (formState.role === "cmo") {
      if (countWords(formState.cmoPlan) > WORD_LIMITS.cmoPlan) {
        return "CMO growth plan exceeds 150 words.";
      }
      if (countWords(formState.cmoTake) > WORD_LIMITS.cmoTake) {
        return "CMO take exceeds 100 words.";
      }
      if (countWords(formState.cmoEquity) > WORD_LIMITS.cmoEquity) {
        return "CMO equity question exceeds 100 words.";
      }
    }
    return null;
  };

  const limitError = wordLimitError();
  const isCtoRole = formState.role === "cto";
  const isCmoRole = formState.role === "cmo";
  const baseFieldsComplete =
    formState.name.trim().length > 0 &&
    formState.email.trim().length > 0 &&
    formState.location.trim().length > 0 &&
    formState.university.trim().length > 0 &&
    formState.majorField.trim().length > 0 &&
    formState.linkedin.trim().length > 0 &&
    formState.socials.trim().length > 0 &&
    formState.interest.trim().length > 0 &&
    formState.alignmentVision.trim().length > 0 &&
    formState.studiesBalance.trim().length > 0 &&
    Boolean(resumeFile);
  const ctoFieldsComplete =
    !isCtoRole ||
    (formState.github.trim().length > 0 &&
      formState.ctoHardest.trim().length > 0 &&
      formState.ctoStack.trim().length > 0 &&
      formState.ctoEquity.trim().length > 0);
  const cmoFieldsComplete =
    !isCmoRole ||
    (formState.cmoBuilt.trim().length > 0 &&
      formState.cmoPlan.trim().length > 0 &&
      formState.cmoTake.trim().length > 0 &&
      formState.cmoEquity.trim().length > 0);
  const requiredFieldsComplete = baseFieldsComplete && ctoFieldsComplete && cmoFieldsComplete;
  const isFormIncomplete =
    !formState.role ||
    !requiredFieldsComplete ||
    Boolean(limitError) ||
    (shouldUseCaptcha && !captchaToken);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formStatus.type === "submitting") return;

    if (!formState.role) {
      setFormStatus({ type: "error", message: "Please choose a role." });
      return;
    }

    if (!requiredFieldsComplete) {
      setFormStatus({ type: "error", message: "Please fill out all required fields." });
      return;
    }

    if (limitError) {
      setFormStatus({ type: "error", message: limitError });
      return;
    }

    if (shouldUseCaptcha && !captchaToken) {
      setFormStatus({
        type: "error",
        message: "Please complete the verification step before submitting.",
      });
      return;
    }

    setFormStatus({ type: "submitting" });

    const payload = {
      role: formState.role,
      name: formState.name.trim(),
      email: formState.email.trim(),
      location: formState.location.trim(),
      university_background: formState.university.trim(),
      major_field: formState.majorField.trim(),
      linkedin_url: formState.linkedin.trim(),
      social_links: formState.socials.trim(),
      interest_reason: formState.interest.trim(),
      alignment_vision: formState.alignmentVision.trim(),
      studies_balance: formState.studiesBalance.trim(),
      equity_reason: formState.role === "cto" ? formState.ctoEquity.trim() : formState.cmoEquity.trim(),
      github_url: formState.role === "cto" ? formState.github.trim() : "",
      hardest_build: formState.role === "cto" ? formState.ctoHardest.trim() : "",
      tech_stack: formState.role === "cto" ? formState.ctoStack.trim() : "",
      built_links: formState.role === "cmo" ? formState.cmoBuilt.trim() : "",
      growth_plan: formState.role === "cmo" ? formState.cmoPlan.trim() : "",
      growth_take: formState.role === "cmo" ? formState.cmoTake.trim() : "",
      captcha_token: shouldUseCaptcha ? captchaToken : null,
    };

    const resumeCandidate = resumeFile ?? resumeInputRef.current?.files?.[0] ?? null;
    if (!resumeCandidate) {
      setFormStatus({ type: "error", message: "Resume/CV is required." });
      return;
    }

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      if (typeof value === "boolean") {
        formData.append(key, value ? "true" : "false");
        return;
      }
      formData.append(key, String(value));
    });
    formData.append("resume", resumeCandidate);
    const body: BodyInit = formData;

    try {
      const response = await fetch("/api/p/api/hire/applications", {
        method: "POST",
        body,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const messageCandidates = [
          typeof data?.detail === "string" ? data.detail : null,
          typeof data?.error?.message === "string" ? data.error.message : null,
          typeof data?.message === "string" ? data.message : null,
        ].filter((value): value is string => Boolean(value && value.trim()));
        const message = messageCandidates[0] ?? "Something went wrong. Please try again.";
        setFormStatus({ type: "error", message });
        if (shouldUseCaptcha) {
          resetCaptcha();
        }
        return;
      }

      setFormStatus({
        type: "success",
        message: "Thank you for your submission. We'll reach out in 48 hours if we want to interview.",
      });
      router.replace("/hire/thanks");
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Submission failed.";
      setFormStatus({ type: "error", message });
      if (shouldUseCaptcha) {
        resetCaptcha();
      }
    }
  };

  return (
    <section ref={sectionRef} className="relative w-full min-h-dvh overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-x-0 top-0 w-full h-dvh touch-pan-y"
        aria-label="Interactive alignment logo particle field"
      />
      <div
        className="pointer-events-none absolute inset-x-0"
        style={{
          top: "calc(var(--logo-bottom, 100dvh) - clamp(140px, 24vh, 240px))",
          height: "clamp(140px, 24vh, 240px)",
          background:
            "linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.9) 100%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-black"
        style={{ top: "var(--logo-bottom, 100dvh)" }}
        aria-hidden
      />
      <div className="relative z-10 flex min-h-dvh w-full flex-col items-center px-6 pb-20 pt-[calc(var(--nav-safe-space)+1.5rem)]">
        <div
          ref={contentRef}
          className="w-full max-w-4xl text-center pt-[calc(var(--logo-bottom,100dvh)+1.5rem)]"
        >
          <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">
            We&apos;re building Gray
          </h1>
          <p className="mt-4 text-left text-sm sm:text-base text-white/80 leading-relaxed">
            Gray is a proactive AI that turns intentions into outcomes. Most people know what
            they want but don&apos;t know how to get there, or they know how but never follow
            through. Gray bridges that gap: it plans with you, teaches you what you need to know,
            and holds you accountable until it&apos;s done.
          </p>
          <p className="mt-4 text-left text-sm sm:text-base text-white/80 leading-relaxed">
            Right now, only the ultra-wealthy have this&mdash;personal assistants, executive
            coaches, accountability partners on speed dial. Gray makes that accessible to a
            student in Jakarta and a grad from Stanford equally.
          </p>
          <p className="mt-4 text-left text-sm sm:text-base text-white/80 leading-relaxed">
            We&apos;re building in Depok&mdash;where Universitas Indonesia feeds us top-tier talent
            daily and living costs stay light enough that every dollar goes toward shipping
            product, not rent.
          </p>
          <p className="mt-4 text-left text-sm sm:text-base text-white/70">
            B2C, freemium, launching in Indonesia + globally.
          </p>

          <p className="mt-4 text-left text-sm sm:text-base text-white/80">
            We&apos;re looking for co-founders (equity only):
          </p>

          <div className="mt-6 text-left">
            <p className="text-sm sm:text-base font-mono uppercase tracking-[0.28em] text-white/60">
              What both need
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm sm:text-base text-white/70">
              <li>Fluent English (required - we&apos;re going global)</li>
              <li>Can work in Depok/Jakarta area (UI students strongly preferred)</li>
            </ul>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-sm border border-white/10 bg-black/40 px-6 py-6 text-left">
              <h2 className="text-lg sm:text-xl font-mono font-semibold text-white">CTO</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm sm:text-base text-white/70">
                <li>You can actually build and ship product fast</li>
                <li>Full-stack, comfortable with AI/LLMs and scale</li>
                <li>You&apos;ll own the technical side (I&apos;ll support, but you will carry it).</li>
              </ul>
            </div>
            <div className="rounded-sm border border-white/10 bg-black/40 px-6 py-6 text-left">
              <h2 className="text-lg sm:text-xl font-mono font-semibold text-white">CMO</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm sm:text-base text-white/70">
                <li>Own ALL distribution: Twitter, Instagram, content, community, getting users</li>
                <li>Build our brand from 0</li>
                <li>Actually good at social media (we&apos;ll check your profiles)</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-sm border border-white/10 bg-black/40 px-6 py-6 text-left">
              <h3 className="text-sm sm:text-base font-mono uppercase tracking-[0.12em] text-white/60">
                What we have
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm sm:text-base text-white/70">
                <li>One technical founder &mdash; I built v1</li>
                <li>Clear product vision</li>
                <li>Working prototype</li>
              </ul>
            </div>
            <div className="rounded-sm border border-white/10 bg-black/40 px-6 py-6 text-left">
              <h3 className="text-sm sm:text-base font-mono uppercase tracking-[0.12em] text-white/60">
                What we need
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm sm:text-base text-white/70">
                <li>CTO who can take over technical execution so I can focus on CEO work</li>
                <li>CMO who can make people care about this</li>
              </ul>
            </div>
            <div className="rounded-sm border border-white/10 bg-black/40 px-6 py-6 text-left">
              <h3 className="text-sm sm:text-base font-mono uppercase tracking-[0.12em] text-white/60">
                What we don&apos;t have
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm sm:text-base text-white/70">
                <li>Funding (yet)</li>
                <li>Salaries</li>
                <li>Office</li>
                <li>Patience for dorks or unclear commitment</li>
              </ul>
            </div>
          </div>

          <p className="mt-8 text-xs sm:text-sm text-white/60">
            A note on AI-generated applications: Using AI to write your responses is pointless - we
            can tell, and more importantly, if you can&apos;t write compelling copy yourself, you
            shouldn&apos;t apply. Also, AI humanizers don&apos;t work, so don&apos;t bother trying to trick
            us.
          </p>

          <form
            className="mt-12 w-full max-w-3xl mx-auto grid gap-6 text-left"
            onSubmit={handleSubmit}
          >
            <div className="grid gap-2">
              <label
                className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                htmlFor="hire-role"
              >
                Role
                <span className="ml-1 text-red-400 tracking-normal">*</span>
              </label>
              <select
                id="hire-role"
                name="role"
                required
                value={formState.role}
                onChange={updateField("role")}
                className="hire-select w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white focus:border-white/40 focus:outline-none"
              >
                <option value="" disabled>
                  Choose a role
                </option>
                <option value="cto">CTO</option>
                <option value="cmo">CMO</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                htmlFor="hire-name"
              >
                Full name
                <span className="ml-1 text-red-400 tracking-normal">*</span>
              </label>
              <input
                id="hire-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                placeholder="Your name"
                value={formState.name}
                onChange={updateField("name")}
                className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                htmlFor="hire-email"
              >
                Email
                <span className="ml-1 text-red-400 tracking-normal">*</span>
              </label>
              <input
                id="hire-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={formState.email}
                onChange={updateField("email")}
                className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                htmlFor="hire-location"
              >
                Location (Depok optimal)
                <span className="ml-1 text-red-400 tracking-normal">*</span>
              </label>
              <input
                id="hire-location"
                name="location"
                type="text"
                autoComplete="address-level2"
                required
                placeholder="Where are you based?"
                value={formState.location}
                onChange={updateField("location")}
                className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                htmlFor="hire-university"
              >
                University/background
                <span className="ml-1 text-red-400 tracking-normal">*</span>
              </label>
              <input
                id="hire-university"
                name="university"
                type="text"
                required
                placeholder="Your university or background"
                value={formState.university}
                onChange={updateField("university")}
                className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                htmlFor="hire-major"
              >
                Major/Field of Study
                <span className="ml-1 text-red-400 tracking-normal">*</span>
              </label>
              <input
                id="hire-major"
                name="majorField"
                type="text"
                required
                placeholder="Your major or field of study"
                value={formState.majorField}
                onChange={updateField("majorField")}
                className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                htmlFor="hire-resume"
              >
                Resume/CV (PDF)
                <span className="ml-1 text-red-400 tracking-normal">*</span>
              </label>
              <input
                ref={resumeInputRef}
                id="hire-resume"
                name="resume"
                type="file"
                accept=".pdf,application/pdf"
                required
                onChange={handleResumeChange}
                className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-3 text-sm sm:text-base text-white file:mr-4 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-[0.2em] file:text-white/80 hover:file:bg-white/20 focus:border-white/40 focus:outline-none"
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                htmlFor="hire-linkedin"
              >
                LinkedIn
                <span className="ml-1 text-red-400 tracking-normal">*</span>
              </label>
              <input
                id="hire-linkedin"
                name="linkedin"
                type="text"
                inputMode="url"
                required
                placeholder="https://linkedin.com/in/username"
                value={formState.linkedin}
                onChange={updateField("linkedin")}
                className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                htmlFor="hire-socials"
              >
                X or Instagram
                <span className="ml-1 text-red-400 tracking-normal">*</span>
              </label>
              <input
                id="hire-socials"
                name="socials"
                type="text"
                inputMode="url"
                required
                placeholder="https://x.com/username or https://instagram.com/username"
                value={formState.socials}
                onChange={updateField("socials")}
                className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                htmlFor="hire-interest"
              >
                Why are you interested in building Gray? (max 100 words)
                <span className="ml-1 text-red-400 tracking-normal">*</span>
              </label>
              <p className="text-[0.6rem] sm:text-[0.7rem] uppercase tracking-[0.2em] text-white/40">
                {countWords(formState.interest)}/{WORD_LIMITS.interest} words
              </p>
              <textarea
                id="hire-interest"
                name="interest"
                rows={3}
                required
                value={formState.interest}
                onChange={updateField("interest")}
                className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                htmlFor="hire-vision"
              >
                Using your own words, describe Alignment&apos;s vision (max 100 words)
                <span className="ml-1 text-red-400 tracking-normal">*</span>
              </label>
              <p className="text-[0.6rem] sm:text-[0.7rem] uppercase tracking-[0.2em] text-white/40">
                {countWords(formState.alignmentVision)}/{WORD_LIMITS.alignmentVision} words
              </p>
              <textarea
                id="hire-vision"
                name="alignmentVision"
                rows={3}
                required
                value={formState.alignmentVision}
                onChange={updateField("alignmentVision")}
                className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                htmlFor="hire-studies-balance"
              >
                How will you balance this with your studies when the semester starts? (max 100 words)
                <span className="ml-1 text-red-400 tracking-normal">*</span>
              </label>
              <p className="text-[0.6rem] sm:text-[0.7rem] uppercase tracking-[0.2em] text-white/40">
                {countWords(formState.studiesBalance)}/{WORD_LIMITS.studiesBalance} words
              </p>
              <textarea
                id="hire-studies-balance"
                name="studiesBalance"
                rows={3}
                required
                value={formState.studiesBalance}
                onChange={updateField("studiesBalance")}
                className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
            </div>
            {formState.role === "cto" && (
              <>
                <div className="grid gap-2">
                  <label
                    className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                    htmlFor="hire-github"
                  >
                    Link to your GitHub
                    <span className="ml-1 text-red-400 tracking-normal">*</span>
                  </label>
                  <input
                    id="hire-github"
                    name="github"
                    type="text"
                    inputMode="url"
                    required
                    placeholder="https://github.com/username"
                    value={formState.github}
                    onChange={updateField("github")}
                    className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                    htmlFor="hire-cto-hardest"
                  >
                    What&apos;s the hardest technical thing you&apos;ve built? (max 150 words)
                    <span className="ml-1 text-red-400 tracking-normal">*</span>
                  </label>
                  <p className="text-[0.6rem] sm:text-[0.7rem] uppercase tracking-[0.2em] text-white/40">
                    {countWords(formState.ctoHardest)}/{WORD_LIMITS.ctoHardest} words
                  </p>
                  <textarea
                    id="hire-cto-hardest"
                    name="ctoHardest"
                    rows={4}
                    required
                    value={formState.ctoHardest}
                    onChange={updateField("ctoHardest")}
                    className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                    htmlFor="hire-cto-stack"
                  >
                    We&apos;re building a B2C AI product that needs to scale to millions of users.
                    What&apos;s your tech stack and why? (max 150 words)
                    <span className="ml-1 text-red-400 tracking-normal">*</span>
                  </label>
                  <p className="text-[0.6rem] sm:text-[0.7rem] uppercase tracking-[0.2em] text-white/40">
                    {countWords(formState.ctoStack)}/{WORD_LIMITS.ctoStack} words
                  </p>
                  <textarea
                    id="hire-cto-stack"
                    name="ctoStack"
                    rows={4}
                    required
                    value={formState.ctoStack}
                    onChange={updateField("ctoStack")}
                    className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                    htmlFor="hire-cto-equity"
                  >
                    Why equity-only instead of a real job? (max 100 words)
                    <span className="ml-1 text-red-400 tracking-normal">*</span>
                  </label>
                  <p className="text-[0.6rem] sm:text-[0.7rem] uppercase tracking-[0.2em] text-white/40">
                    {countWords(formState.ctoEquity)}/{WORD_LIMITS.ctoEquity} words
                  </p>
                  <textarea
                    id="hire-cto-equity"
                    name="ctoEquity"
                    rows={3}
                    required
                    value={formState.ctoEquity}
                    onChange={updateField("ctoEquity")}
                    className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
                  />
                </div>
              </>
            )}
            {formState.role === "cmo" && (
              <>
                <div className="grid gap-2">
                  <label
                    className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                    htmlFor="hire-cmo-built"
                  >
                    Show us something you built/grew from 0 (links only)
                    <span className="ml-1 text-red-400 tracking-normal">*</span>
                  </label>
                  <textarea
                    id="hire-cmo-built"
                    name="cmoBuilt"
                    rows={3}
                    required
                    value={formState.cmoBuilt}
                    onChange={updateField("cmoBuilt")}
                    className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                    htmlFor="hire-cmo-plan"
                  >
                    You have $0 and 3 months to get 1000 users for an AI that helps people chase
                    their dreams. What do you do? (max 150 words)
                    <span className="ml-1 text-red-400 tracking-normal">*</span>
                  </label>
                  <p className="text-[0.6rem] sm:text-[0.7rem] uppercase tracking-[0.2em] text-white/40">
                    {countWords(formState.cmoPlan)}/{WORD_LIMITS.cmoPlan} words
                  </p>
                  <textarea
                    id="hire-cmo-plan"
                    name="cmoPlan"
                    rows={4}
                    required
                    value={formState.cmoPlan}
                    onChange={updateField("cmoPlan")}
                    className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                    htmlFor="hire-cmo-take"
                  >
                    What&apos;s a take you have about growth/marketing that would make most
                    marketers mad? (max 100 words)
                    <span className="ml-1 text-red-400 tracking-normal">*</span>
                  </label>
                  <p className="text-[0.6rem] sm:text-[0.7rem] uppercase tracking-[0.2em] text-white/40">
                    {countWords(formState.cmoTake)}/{WORD_LIMITS.cmoTake} words
                  </p>
                  <textarea
                    id="hire-cmo-take"
                    name="cmoTake"
                    rows={3}
                    required
                    value={formState.cmoTake}
                    onChange={updateField("cmoTake")}
                    className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    className="text-sm sm:text-base font-mono uppercase tracking-normal text-white/60"
                    htmlFor="hire-cmo-equity"
                  >
                    Why equity-only instead of a real job? (max 100 words)
                    <span className="ml-1 text-red-400 tracking-normal">*</span>
                  </label>
                  <p className="text-[0.6rem] sm:text-[0.7rem] uppercase tracking-[0.2em] text-white/40">
                    {countWords(formState.cmoEquity)}/{WORD_LIMITS.cmoEquity} words
                  </p>
                  <textarea
                    id="hire-cmo-equity"
                    name="cmoEquity"
                    rows={3}
                    required
                    value={formState.cmoEquity}
                    onChange={updateField("cmoEquity")}
                    className="w-full rounded-sm border border-white/15 bg-black/40 px-5 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
                  />
                </div>
              </>
            )}
            {shouldUseCaptcha && (
              <div className="flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={turnstileSiteKey}
                  onSuccess={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => setCaptchaToken(null)}
                />
              </div>
            )}
            <button
              type="submit"
              disabled={formStatus.type === "submitting" || isFormIncomplete}
              className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-white/30 px-8 py-4 text-sm sm:text-base font-mono uppercase tracking-[0.3em] text-white/80 transition-colors duration-300 hover:border-white/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {formStatus.type === "submitting" ? "Submitting..." : "Submit"}
            </button>
            {formStatus.type !== "idle" && formStatus.message ? (
              <p
                className={`text-center text-sm ${formStatus.type === "error" ? "text-red-300" : "text-emerald-200"
                  }`}
              >
                {formStatus.message}
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}
