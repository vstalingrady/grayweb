"use client";

import { FormEvent, useMemo, useState } from "react";
import styles from "./FirstChatOnboarding.module.css";

type TranscriptRole = "gray" | "user";

type TranscriptMessage = {
  id: string;
  role: TranscriptRole;
  text: string;
};

type CheckInCadence = "frequent" | "daily" | "weekly" | "custom";

type Stage =
  | "intro"
  | "name"
  | "reason"
  | "obstacle"
  | "goal"
  | "success"
  | "cadence"
  | "expectations"
  | "questions"
  | "todayAction"
  | "done";

export type FirstChatOnboardingResult = {
  preferredName: string;
  reason: string;
  obstacle: string;
  goal: string;
  success: string;
  cadence: CheckInCadence;
  cadenceDetail?: string;
  clarifyingQuestion?: string;
  todayAction: string;
};

type FirstChatOnboardingProps = {
  viewerName?: string | null;
  onComplete?: (result: FirstChatOnboardingResult) => void;
  onSkip?: () => void;
};

const createMessage = (role: TranscriptRole, text: string): TranscriptMessage => ({
  id: `${role}-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`,
  role,
  text,
});

const CADENCE_OPTIONS: Array<{
  key: CheckInCadence;
  label: string;
  description: string;
}> = [
    {
      key: "frequent",
      label: "🔥 Frequent",
      description: "3x a day • morning, midday, evening",
    },
    {
      key: "daily",
      label: "📅 Daily",
      description: "One honest check-in each morning",
    },
    {
      key: "weekly",
      label: "📊 Weekly",
      description: "Friday reflections + resets",
    },
    {
      key: "custom",
      label: "⚙️ Custom",
      description: "You set the rhythm",
    },
  ];

const cadenceFollowup = (key: CheckInCadence, customDetail?: string) => {
  switch (key) {
    case "frequent":
      return "Cool, I'll check in morning, midday, and evening.";
    case "daily":
      return "Cool, I'll meet you each morning to set the tone.";
    case "weekly":
      return "Cool, I'll drop in each Friday to run the reflection with you.";
    case "custom":
    default:
      return customDetail
        ? `Cool, I'll honor that cadence: ${customDetail}.`
        : "Cool, I'll mirror the cadence you have in mind.";
  }
};

const cadenceFollowupLabel = (key: CheckInCadence, customDetail?: string) => {
  switch (key) {
    case "frequent":
      return "tonight";
    case "daily":
      return "tomorrow morning";
    case "weekly":
      return "Friday";
    case "custom":
    default:
      return customDetail?.trim() ? customDetail.trim() : "when you asked me to";
  }
};

export function FirstChatOnboarding({ viewerName, onComplete, onSkip }: FirstChatOnboardingProps) {
  const [transcript, setTranscript] = useState<TranscriptMessage[]>(() => [
    createMessage(
      "gray",
      [
        "👋 Hey, I'm Gray.",
        "",
        "I'm your AI accountability partner—think of me as the mentor/coach you wish you had, always in your pocket, always honest.",
        "",
        "**Here's what I do:**",
        "• Check in with you regularly (you decide when)",
        "• Remember everything about your goals, habits, and patterns",
        "• Ask the hard questions you need to hear",
        "• Call you out when you're bullshitting yourself",
        "• Help you actually DO what you say you want to do",
        "",
        "This isn't another productivity app. It's having someone who genuinely cares about your growth and won't let you coast.",
        "",
        "Ready to get started?",
      ].join("\n")
    ),
  ]);
  const [stage, setStage] = useState<Stage>("intro");
  const [showIntroDetails, setShowIntroDetails] = useState(false);
  const [preferredName, setPreferredName] = useState<string>(viewerName?.trim() ?? "");
  const [nameDraft, setNameDraft] = useState<string>(viewerName?.trim() ?? "");
  const [reason, setReason] = useState("");
  const [reasonDraft, setReasonDraft] = useState("");
  const [obstacle, setObstacle] = useState("");
  const [obstacleDraft, setObstacleDraft] = useState("");
  const [goal, setGoal] = useState("");
  const [goalDraft, setGoalDraft] = useState("");
  const [success, setSuccess] = useState("");
  const [successDraft, setSuccessDraft] = useState("");
  const [cadence, setCadence] = useState<CheckInCadence | null>(null);
  const [customCadenceDraft, setCustomCadenceDraft] = useState("");
  const [clarifyingQuestion, setClarifyingQuestion] = useState("");
  const [clarifyingQuestionDraft, setClarifyingQuestionDraft] = useState("");
  const [todayAction, setTodayAction] = useState("");
  const [todayActionDraft, setTodayActionDraft] = useState("");
  const [completed, setCompleted] = useState(false);

  const userLabel = useMemo(() => preferredName || viewerName?.split(" ")[0] || "You", [preferredName, viewerName]);

  const appendMessage = (role: TranscriptRole, text: string) => {
    setTranscript((prev) => [...prev, createMessage(role, text)]);
  };

  const handleStart = () => {
    appendMessage("user", "Let's go");
    appendMessage("gray", "First—what should I call you?");
    setStage("name");
  };

  const handleTellMeMore = () => {
    appendMessage("user", "Tell me more");
    setShowIntroDetails(true);
    appendMessage(
      "gray",
      [
        "Here's how I work:",
        "- I'll check in with you throughout the day (you control when/how often)",
        "- I remember everything you tell me—your goals, struggles, patterns",
        "- I ask hard questions and call you out when you're avoiding things",
        "- I'm here to help you actually DO what you say you want to do",
        "",
        "Not another productivity app. More like having a friend who won't let you bullshit yourself.",
        "",
        "Sound good?",
      ].join("\n")
    );
  };

  const handleSkip = () => {
    appendMessage("user", "Not for me");
    appendMessage("gray", "All good. Whenever you want to dive in, just drop a note below and I'll be right here.");
    setStage("done");
    setCompleted(true);
    onSkip?.();
  };

  const handleSubmitName = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      return;
    }
    setPreferredName(trimmed);
    appendMessage("user", trimmed);
    appendMessage(
      "gray",
      [
        `Nice to meet you, ${trimmed}.`,
        "So, what brings you here? What are you trying to do in your life right now?",
        "(Don't overthink it—just tell me what's on your mind.)",
      ].join("\n\n")
    );
    setStage("reason");
    setNameDraft("");
  };

  const handleSubmitReason = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = reasonDraft.trim();
    if (!trimmed) {
      return;
    }
    setReason(trimmed);
    appendMessage("user", trimmed);
    appendMessage(
      "gray",
      [
        `Got it. So ${trimmed}.`,
        "Here's the real question: What's stopping you?",
        "Like, if you could wave a magic wand and change ONE thing about yourself or your situation, what would it be?",
      ].join("\n\n")
    );
    setStage("obstacle");
    setReasonDraft("");
  };

  const handleSubmitObstacle = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = obstacleDraft.trim();
    if (!trimmed) {
      return;
    }
    setObstacle(trimmed);
    appendMessage("user", trimmed);
    appendMessage(
      "gray",
      [
        "Okay, that's real. Thanks for being honest.",
        "What's the ONE thing you want to make progress on in the next 30 days?",
        "Not everything. Just ONE thing that, if you made progress on it, would make you feel like this was worth it.",
      ].join("\n\n")
    );
    setStage("goal");
    setObstacleDraft("");
  };

  const handleSubmitGoal = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = goalDraft.trim();
    if (!trimmed) {
      return;
    }
    setGoal(trimmed);
    appendMessage("user", trimmed);
    appendMessage(
      "gray",
      [`"${trimmed}" - let me make sure I got this right.`, "So in 30 days, what does success look like? What will be different?"].join(
        "\n\n"
      )
    );
    setStage("success");
    setGoalDraft("");
  };

  const handleSubmitSuccess = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = successDraft.trim();
    if (!trimmed) {
      return;
    }
    setSuccess(trimmed);
    appendMessage("user", trimmed);
    appendMessage(
      "gray",
      [
        "Perfect. I'm going to help you actually do that.",
        "Here's how this works:",
        "- I'll check in with you regularly—not just to ask \"how's it going?\" but to actually hold you accountable and help you figure things out when you're stuck.",
        "",
        "How often do you want me to check in?",
        "",
        "🔥 Frequent - 3x a day (morning, midday, evening)",
        "📅 Daily - Just mornings",
        "📊 Weekly - Friday reflections",
        "⚙️ Custom - You decide",
        "",
        "Most people start with Frequent and adjust from there.",
      ].join("\n")
    );
    setStage("cadence");
    setSuccessDraft("");
  };

  const beginExpectations = (choice: CheckInCadence, detail?: string) => {
    const label = CADENCE_OPTIONS.find((option) => option.key === choice)?.label ?? choice;
    const choiceSummary = choice === "custom" && detail ? `${label}: ${detail}` : label;
    appendMessage("user", choiceSummary);
    const lead = cadenceFollowup(choice, detail);
    appendMessage(
      "gray",
      [
        lead,
        "",
        "A few things to know:",
        "- I remember everything. If you tell me something today, I'll bring it up next week.",
        "- I'll be honest with you, even when it's uncomfortable. If you're avoiding something, I'll call it out.",
        "- You can always tell me to back off, check in less, or adjust how I work.",
        "- I'm on your side. Even when I'm challenging you, it's because I want you to win.",
        "",
        "Sound good?",
      ].join("\n")
    );
    setStage("expectations");
  };

  const handleCadenceSelect = (choice: CheckInCadence) => {
    if (choice === "custom") {
      setCadence(choice);
      return;
    }
    setCadence(choice);
    setCustomCadenceDraft("");
    beginExpectations(choice);
  };

  const handleCustomCadenceSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (cadence !== "custom") {
      return;
    }
    const trimmed = customCadenceDraft.trim();
    if (!trimmed) {
      return;
    }
    setCustomCadenceDraft(trimmed);
    beginExpectations("custom", trimmed);
  };

  const startTodayAction = () => {
    const name = preferredName || viewerName || "friend";
    appendMessage(
      "gray",
      [
        `Alright ${name}, here's what we're doing today.`,
        `You said you want to ${goal || "make a shift"}.`,
        "What's the smallest thing you can do TODAY that moves you toward that?",
        "Doesn't have to be big. Just something real.",
      ].join("\n\n")
    );
    setStage("todayAction");
  };

  const handleExpectationsReady = () => {
    appendMessage("user", "I'm ready");
    startTodayAction();
  };

  const handleExpectationsQuestions = () => {
    appendMessage("user", "I have questions");
    appendMessage("gray", "Ask me anything.");
    setStage("questions");
  };

  const handleSubmitQuestion = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = clarifyingQuestionDraft.trim();
    if (!trimmed) {
      return;
    }
    setClarifyingQuestion(trimmed);
    appendMessage("user", trimmed);
    appendMessage(
      "gray",
      "Love that you're thinking about that. We'll keep it in the plan and I’ll be straight with you when it matters. Ready?"
    );
    setClarifyingQuestionDraft("");
    startTodayAction();
  };

  const finalizeOnboarding = (action: string) => {
    if (completed || !cadence) {
      return;
    }
    const followupLabel = cadenceFollowupLabel(cadence, cadence === "custom" ? customCadenceDraft : undefined);
    appendMessage(
      "gray",
      [
        `Perfect. I'll check back ${followupLabel} to see how it went.`,
        "",
        "And hey—glad you're here. Let's do this. 🚀",
      ].join("\n")
    );
    setTodayAction(action);
    setStage("done");
    setCompleted(true);
    onComplete?.({
      preferredName: preferredName || viewerName || "",
      reason,
      obstacle,
      goal,
      success,
      cadence,
      cadenceDetail: cadence === "custom" ? customCadenceDraft.trim() || undefined : undefined,
      clarifyingQuestion: clarifyingQuestion.trim() || undefined,
      todayAction: action,
    });
  };

  const handleSubmitTodayAction = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = todayActionDraft.trim();
    if (!trimmed) {
      return;
    }
    appendMessage("user", trimmed);
    setTodayActionDraft("");
    finalizeOnboarding(trimmed);
  };

  const renderPrompt = () => {
    if (stage === "intro") {
      return (
        <>
          <p className={styles.promptLabel}>Ready to get started?</p>
          <div className={styles.buttonRow}>
            {showIntroDetails ? (
              <>
                <button type="button" className={`${styles.button} ${styles.primary}`} onClick={handleStart}>
                  Yeah, let's start
                </button>
                <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={handleSkip}>
                  Not for me
                </button>
              </>
            ) : (
              <>
                <button type="button" className={`${styles.button} ${styles.primary}`} onClick={handleStart}>
                  Let's go
                </button>
                <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={handleTellMeMore}>
                  Tell me more
                </button>
              </>
            )}
          </div>
        </>
      );
    }

    if (stage === "name") {
      return (
        <form className={styles.fieldGroup} onSubmit={handleSubmitName}>
          <label htmlFor="onboarding-name" className={styles.promptLabel}>
            Your name
          </label>
          <input
            id="onboarding-name"
            className={styles.input}
            value={nameDraft}
            autoFocus
            placeholder="e.g., Alex"
            onChange={(event) => setNameDraft(event.target.value)}
          />
          <div className={styles.buttonRow}>
            <button type="submit" className={`${styles.button} ${styles.primary}`}>
              Continue
            </button>
          </div>
        </form>
      );
    }

    if (stage === "reason") {
      return (
        <form className={styles.fieldGroup} onSubmit={handleSubmitReason}>
          <label htmlFor="onboarding-reason" className={styles.promptLabel}>
            What's on your mind?
          </label>
          <textarea
            id="onboarding-reason"
            className={styles.textarea}
            value={reasonDraft}
            autoFocus
            placeholder="Share what's pulling you here."
            onChange={(event) => setReasonDraft(event.target.value)}
          />
          <div className={styles.buttonRow}>
            <button type="submit" className={`${styles.button} ${styles.primary}`}>
              Continue
            </button>
          </div>
        </form>
      );
    }

    if (stage === "obstacle") {
      return (
        <form className={styles.fieldGroup} onSubmit={handleSubmitObstacle}>
          <label htmlFor="onboarding-obstacle" className={styles.promptLabel}>
            What's stopping you?
          </label>
          <textarea
            id="onboarding-obstacle"
            className={styles.textarea}
            value={obstacleDraft}
            autoFocus
            placeholder="Name the blocker, habit, or pattern."
            onChange={(event) => setObstacleDraft(event.target.value)}
          />
          <div className={styles.buttonRow}>
            <button type="submit" className={`${styles.button} ${styles.primary}`}>
              Continue
            </button>
          </div>
        </form>
      );
    }

    if (stage === "goal") {
      return (
        <form className={styles.fieldGroup} onSubmit={handleSubmitGoal}>
          <label htmlFor="onboarding-goal" className={styles.promptLabel}>
            One thing for the next 30 days
          </label>
          <textarea
            id="onboarding-goal"
            className={styles.textarea}
            value={goalDraft}
            autoFocus
            placeholder="What do you want to see progress on?"
            onChange={(event) => setGoalDraft(event.target.value)}
          />
          <div className={styles.buttonRow}>
            <button type="submit" className={`${styles.button} ${styles.primary}`}>
              Continue
            </button>
          </div>
        </form>
      );
    }

    if (stage === "success") {
      return (
        <form className={styles.fieldGroup} onSubmit={handleSubmitSuccess}>
          <label htmlFor="onboarding-success" className={styles.promptLabel}>
            What does success look like?
          </label>
          <textarea
            id="onboarding-success"
            className={styles.textarea}
            value={successDraft}
            autoFocus
            placeholder="Paint the 30-day picture."
            onChange={(event) => setSuccessDraft(event.target.value)}
          />
          <div className={styles.buttonRow}>
            <button type="submit" className={`${styles.button} ${styles.primary}`}>
              Continue
            </button>
          </div>
        </form>
      );
    }

    if (stage === "cadence") {
      return (
        <div className={styles.fieldGroup}>
          <p className={styles.promptLabel}>Pick the check-in cadence</p>
          <div className={styles.cadenceGrid}>
            {CADENCE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={styles.cadenceButton}
                data-active={cadence === option.key}
                onClick={() => handleCadenceSelect(option.key)}
              >
                <span className={styles.cadenceLabel}>{option.label}</span>
                <span className={styles.cadenceDescription}>{option.description}</span>
              </button>
            ))}
          </div>
          {cadence === "custom" ? (
            <form className={styles.fieldGroup} onSubmit={handleCustomCadenceSubmit}>
              <label htmlFor="onboarding-custom-cadence" className={styles.promptLabel}>
                Describe the rhythm
              </label>
              <input
                id="onboarding-custom-cadence"
                className={styles.input}
                value={customCadenceDraft}
                autoFocus
                placeholder="e.g., Sun night planning, Wed afternoon reset"
                onChange={(event) => setCustomCadenceDraft(event.target.value)}
              />
              <div className={styles.buttonRow}>
                <button type="submit" className={`${styles.button} ${styles.primary}`}>
                  Lock it in
                </button>
              </div>
            </form>
          ) : null}
        </div>
      );
    }

    if (stage === "expectations") {
      return (
        <div className={styles.fieldGroup}>
          <p className={styles.promptLabel}>Sound good?</p>
          <div className={styles.buttonRow}>
            <button type="button" className={`${styles.button} ${styles.primary}`} onClick={handleExpectationsReady}>
              I'm ready
            </button>
            <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={handleExpectationsQuestions}>
              I have questions
            </button>
          </div>
        </div>
      );
    }

    if (stage === "questions") {
      return (
        <form className={styles.fieldGroup} onSubmit={handleSubmitQuestion}>
          <label htmlFor="onboarding-question" className={styles.promptLabel}>
            Ask away
          </label>
          <textarea
            id="onboarding-question"
            className={styles.textarea}
            value={clarifyingQuestionDraft}
            autoFocus
            placeholder="What do you want to know before we roll?"
            onChange={(event) => setClarifyingQuestionDraft(event.target.value)}
          />
          <div className={styles.buttonRow}>
            <button type="submit" className={`${styles.button} ${styles.primary}`}>
              Send it
            </button>
          </div>
        </form>
      );
    }

    if (stage === "todayAction") {
      return (
        <form className={styles.fieldGroup} onSubmit={handleSubmitTodayAction}>
          <label htmlFor="onboarding-today" className={styles.promptLabel}>
            Smallest move today
          </label>
          <textarea
            id="onboarding-today"
            className={styles.textarea}
            value={todayActionDraft}
            autoFocus
            placeholder="Block 25 minutes for outreach, write the outline, text the trainer..."
            onChange={(event) => setTodayActionDraft(event.target.value)}
          />
          <div className={styles.buttonRow}>
            <button type="submit" className={`${styles.button} ${styles.primary}`}>
              Commit
            </button>
          </div>
        </form>
      );
    }

    if (stage === "done") {
      return (
        <div className={styles.fieldGroup}>
          <p className={styles.promptLabel}>You're set.</p>
          <p className={styles.note}>Drop your next thought in the composer below and I'll keep the thread going.</p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={styles.onboarding}>
      <div className={styles.card}>
        <div className={styles.header}>
          <p className={styles.headerTitle}>First chat onboarding</p>
          <p className={styles.headerMeta}>2–3 minutes • sets the tone</p>
        </div>
        <div className={styles.feed}>
          {transcript.map((message) => (
            <div key={message.id} className={styles.message} data-role={message.role}>
              <p className={styles.messageLabel}>{message.role === "gray" ? "Gray" : userLabel}</p>
              <p className={styles.messageBody}>{message.text}</p>
            </div>
          ))}
        </div>
        <div className={styles.prompt}>{renderPrompt()}</div>
      </div>
    </div>
  );
}
