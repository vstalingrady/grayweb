import { useCallback, useState } from "react";
import type { UserUpdate } from "@/lib/api";
import type { QuestionnaireSession } from "@/lib/questionnaire";
import type { ChatContextValue, ChatSession } from "../types";

type UseQuestionnaireOptions = {
  ensureGeneralSession: () => ChatSession;
  appendMessage: ChatContextValue["appendMessage"];
  updateSession: ChatContextValue["updateSession"];
  updateUser: (userData: UserUpdate) => Promise<void>;
};

type UseQuestionnaireResult = {
  questionnaireSession: QuestionnaireSession | null;
  startQuestionnaire: (mode: "quick" | "deep") => void;
  cancelQuestionnaire: () => void;
  handleQuestionnaireResponse: (content: string, session: QuestionnaireSession) => Promise<void>;
};

export const useQuestionnaire = ({
  ensureGeneralSession,
  appendMessage,
  updateSession,
  updateUser,
}: UseQuestionnaireOptions): UseQuestionnaireResult => {
  const [questionnaireSession, setQuestionnaireSession] = useState<QuestionnaireSession | null>(null);

  const startQuestionnaire = useCallback((mode: "quick" | "deep") => {
    void mode;
    // Premade questionnaire messaging has been retired; keep state reset.
    setQuestionnaireSession(null);
  }, []);

  const cancelQuestionnaire = useCallback(() => {
    setQuestionnaireSession(null);
  }, []);

  const handleQuestionnaireResponse = useCallback(
    async (content: string, session: QuestionnaireSession) => {
      const generalSession = ensureGeneralSession();
      const trimmed = content.trim();

      // 1. Append user message
      appendMessage(generalSession.id, "user", trimmed);
      updateSession(generalSession.id, { isResponding: true });

      // 2. Process response
      // For now, we just move to the next question in the quick list
      // In a real implementation, we would use the Python logic (evaluateSmartGoal, etc.)
      // and potentially call the LLM for "deep" mode.

      const nextSession = { ...session };
      let responseText = "";

      if (session.phase === "foundation") {
        const currentQ = session.quickQuestions[session.step];
        if (currentQ) {
          nextSession.foundationAnswers[currentQ.key] = trimmed;
          nextSession.step += 1;
        }

        const nextQ = session.quickQuestions[nextSession.step];
        if (nextQ) {
          responseText = nextQ.prompt;
          if (nextQ.clarification) {
            responseText += `\n\n_${nextQ.clarification}_`;
          }
        } else {
          // End of foundation
          nextSession.phase = "personalized"; // or 'complete'
          responseText = "Thanks! I've got the basics. I've updated your profile with this information.";

          // Synthesize and save profile
          const answers = nextSession.foundationAnswers;
          const aboutParts: string[] = [];
          if (answers.goals) aboutParts.push(`Goals: ${answers.goals}`);
          if (answers.wins) aboutParts.push(`Wins: ${answers.wins}`);
          if (answers.obstacles) aboutParts.push(`Obstacles: ${answers.obstacles}`);

          const updatePayload: UserUpdate = {
            personalization_nickname: answers.name || null,
            personalization_occupation: answers.focus || null,
            personalization_about: aboutParts.length > 0 ? aboutParts.join("\n\n") : null,
            // NOTE: Do NOT save custom_instructions from onboarding - this should only be set
            // manually by the user in Settings. The AI should not auto-generate response guidelines.
            has_seen_general_chat: true, // Mark as seen so we don't trigger again
          };

          void updateUser(updatePayload).catch((error) =>
            console.error("Failed to save questionnaire profile:", error)
          );

          setQuestionnaireSession(null); // End it for now
        }
      }

      if (responseText) {
        setTimeout(() => {
          appendMessage(generalSession.id, "assistant", responseText);
          updateSession(generalSession.id, { isResponding: false });
        }, 500);
      } else {
        updateSession(generalSession.id, { isResponding: false });
      }

      if (nextSession.phase !== "personalized") {
        setQuestionnaireSession(nextSession);
      }
    },
    [appendMessage, ensureGeneralSession, updateSession, updateUser]
  );

  return {
    questionnaireSession,
    startQuestionnaire,
    cancelQuestionnaire,
    handleQuestionnaireResponse,
  };
};

