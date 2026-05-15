import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import type { Session } from "@supabase/supabase-js";
// REFACTOR: Imported the new AIAction type for the simplified, sequential lesson flow.
import type {
  Lesson,
  Message,
  CourseCategory,
  LessonProgress,
  Profile,
  BlackboardContent,
  AIAction,
  DrawingOperation,
} from "../types";
import { ChatWindow } from "./ChatWindow";
import { ChatInput } from "./ChatInput";
import { InteractiveAvatar } from "./InteractiveAvatar";
import { initializeChat, sendMessageToAI } from "../services/deepseekService";
import type { ChatHistory } from "../services/deepseekService";
import { useAppStore } from "../store/useAppStore";
import { AvatarCreator } from "./AvatarCreator";
import { DEFAULT_AVATAR_URL } from "../constants";
import { InteractiveChoices } from "./InteractiveChoices";
import { CourseSelector } from "./CourseSelector";
import { HelpModal } from "./HelpModal";
import { supabase } from "../services/supabaseClient";
import { Blackboard } from "./Blackboard";
import * as pdfjsLib from "pdfjs-dist";
import { parseLessonScript } from "../lessons/iot/registry";
import { QuizCard, type QuizPayload } from "./QuizCard";
import { ChangePasswordModal } from "./ChangePasswordModal";
import {
  fetchStudentLessonRecord,
  submitQuizAttempt,
  upsertMaxProgressIndex,
  type StudentLessonRecord,
} from "../services/studentRecords";

import { usePersistentState } from "../hooks/usePersistentState";

const AVATAR_STORAGE_KEY = "interactive-tutor-avatar-url";
const SESSION_STARTED_KEY = "interactive-tutor-session-started";
const MESSAGES_STORAGE_KEY = "interactive-tutor-messages";
const CHOICES_STORAGE_KEY = "interactive-tutor-choices";
const CAPTION_STORAGE_KEY = "interactive-tutor-caption";
const SCRIPT_INDEX_STORAGE_KEY_PREFIX = "interactive-tutor-script-index-";
const BLACKBOARD_CONTENT_STORAGE_KEY = "interactive-tutor-blackboard-content";
const DRAWING_STATE_STORAGE_KEY = "interactive-tutor-drawing-state";
const IS_PAUSED_STORAGE_KEY = "interactive-tutor-is-paused";
const WATCH_PROGRESS_KEY_PREFIX = "interactive-tutor-watch-progress-";
const CURRENT_LESSON_STORAGE_KEY = "interactive-tutor-current-lesson";

interface StudentAppProps {
  session: Session;
  profile: Profile | null;
}

export const StudentApp: React.FC<StudentAppProps> = ({ session, profile }) => {
  const speechTimeoutRef = useRef<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [messages, setMessages] = usePersistentState<Message[]>(
    MESSAGES_STORAGE_KEY,
    [],
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<ChatHistory | null>(null);
  const [currentLesson, setCurrentLesson] = usePersistentState<Lesson | null>(
    CURRENT_LESSON_STORAGE_KEY,
    null,
  );
  const [textToSpeak, setTextToSpeak] = useState<string>("");
  const [isSessionStarted, setIsSessionStarted] = usePersistentState<boolean>(
    SESSION_STARTED_KEY,
    false,
  );
  const [showAvatarCreator, setShowAvatarCreator] = useState(false);
  const [isCourseSelectorOpen, setIsCourseSelectorOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState(
    () => localStorage.getItem(AVATAR_STORAGE_KEY) || DEFAULT_AVATAR_URL,
  );
  const [multiChoiceCorrectAnswers, setMultiChoiceCorrectAnswers] =
    React.useState<string[] | null>(null);
  const [interactiveChoices, setInteractiveChoices] = usePersistentState<
    string[] | null
  >(CHOICES_STORAGE_KEY, null);
  const [pendingChoices, setPendingChoices] = useState<{
    options: string[];
    correctAnswers?: string[];
  } | null>(null);
  const [currentLessonQuizScore, setCurrentLessonQuizScore] = useState(0);
  const [currentLessonTotalQuestions, setCurrentLessonTotalQuestions] =
    useState(0);
  const [courseCategories, setCourseCategories] = useState<CourseCategory[]>(
    [],
  );
  const [lessonProgress, setLessonProgress] = useState<LessonProgress[]>([]);
  const [studentLessonRecords, setStudentLessonRecords] = useState<
    StudentLessonRecord[]
  >([]);
  const [currentWatchProgress, setCurrentWatchProgress] = useState(0);
  const [blackboardContent, setBlackboardContent] =
    usePersistentState<BlackboardContent>(BLACKBOARD_CONTENT_STORAGE_KEY, null);
  const [captionText, setCaptionText] = usePersistentState<string>(
    CAPTION_STORAGE_KEY,
    "",
  );
  const [systemStatus, setSystemStatus] = usePersistentState<
    "playing" | "paused" | "asking_question" | "interrupted"
  >("interactive-tutor-system-status", "playing");
  // Used only for the progress bar drag preview (commit on pointer up).
  const [seekPreviewIndex, setSeekPreviewIndex] = useState<number | null>(null);
  const [scriptIndex, setScriptIndex] = useState<number>(0);
  const [maxUnlockedIndex, setMaxUnlockedIndex] = useState<number>(0);
  const [activeQuiz, setActiveQuiz] = useState<QuizPayload | null>(null);
  const [isQuizSubmitting, setIsQuizSubmitting] = useState(false);
  const [attemptedQuizIds, setAttemptedQuizIds] = useState<Set<string>>(
    new Set(),
  );
  // 可调节宽度状态
  const [leftPanelWidth, setLeftPanelWidth] = useState(20); // 左侧宽度百分比 (15%-25%)
  const [rightPanelWidth, setRightPanelWidth] = useState(20); // 右侧宽度百分比 (15%-25%)
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const visibilityPausedRef = useRef(false);
  const seekCommitGuardRef = useRef(false);
  const sentenceQueueRef = useRef<string[]>([]);
  const speechCancelledRef = useRef(false);
  const lastAdvancedFromSpeechIndexRef = useRef<number | null>(null);
  const hasRestoredProgressRef = useRef(false);
  const currentLessonIdRef = useRef<string | null>(null);
  const [drawingState, setDrawingState] = usePersistentState<{
    operations: DrawingOperation[];
    background: "black" | "white" | "transparent";
  }>(DRAWING_STATE_STORAGE_KEY, {
    operations: [],
    background: "transparent",
  });

  const { lessonScript, lessonSummary } = useMemo(() => {
    if (!currentLesson) return { lessonScript: [] as AIAction[], lessonSummary: '' };
    return {
      lessonScript: parseLessonScript(currentLesson.system_prompt),
      lessonSummary: currentLesson.lesson_summary?.trim() ?? '',
    };
  }, [currentLesson?.id, currentLesson?.system_prompt, currentLesson?.lesson_summary]);

  /** Indices in lessonScript that are `type: 'speech'` or `show_video` command. Used for progress-bar mapping. */
  const progressIndices = useMemo(
    () =>
      lessonScript
        .map((a, i) => {
          if (a.type === "speech") return i;
          if (a.type === "command" && a.payload.name === "show_video") return i;
          return -1;
        })
        .filter((i) => i >= 0),
    [lessonScript],
  );

  const scriptIndexToProgressIndex = useCallback(
    (si: number): number => {
      const idx = progressIndices.findIndex((sp) => sp >= si);
      if (idx === -1)
        return progressIndices.length > 0 ? progressIndices.length - 1 : 0;
      if (progressIndices[idx] === si) return idx;
      return idx > 0 ? idx - 1 : 0;
    },
    [progressIndices],
  );

  const progressIndexToScriptIndex = useCallback(
    (si: number): number => {
      if (progressIndices.length === 0) return 0;
      return progressIndices[Math.min(si, progressIndices.length - 1)];
    },
    [progressIndices],
  );

  const {
    isSpeakingSentence: isSpeaking,
    resetAvatarState,
    volume,
    setVolume,
    speechRate,
    setSpeechRate,
  } = useAppStore() as any;

  // If we paused due to a seek (progress bar jump), we need to re-process the current action on resume.
  const needsProcessOnResumeRef = useRef(false);

  const pauseLesson = () => {
    // Manual pause: do not force a re-process on resume.
    needsProcessOnResumeRef.current = false;
    setSystemStatus("paused");
  };


  const resumeLesson = () => {
  // 用当前按钮点击的手势激活音频上下文
  const dummyUtterance = new SpeechSynthesisUtterance("");
  dummyUtterance.volume = 0;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(dummyUtterance);

  // 直接设置为 playing，利用同步状态变化，AudioContext 可能被激活
  needsProcessOnResumeRef.current = true;
  setSystemStatus("playing");
};

  useEffect(() => {
    if (systemStatus === "paused") {
      window.speechSynthesis.pause();
    } else if (systemStatus === "playing") {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }
  }, [systemStatus]);

  const stopSpeaking = useCallback(() => {
    // Mark current speech as cancelled so we don't accidentally reveal pending choices.
    speechCancelledRef.current = true;
    window.speechSynthesis.cancel();
    setTextToSpeak("");
    sentenceQueueRef.current = [];
    resetAvatarState();
  }, [resetAvatarState]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        sessionStorage.clear();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const workerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.worker.min.mjs`;
    fetch(workerUrl)
      .then((response) => response.text())
      .then((text) => {
        const blob = new Blob([text], { type: "application/javascript" });
        pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
      })
      .catch((error) => {
        console.error("Failed to set up PDF.js worker:", error);
      });
  }, []);

  const completeLesson = useCallback(
    async (lessonId: string) => {
      if (
        lessonProgress.some((p) => p.lesson_id === lessonId)
      ) {
        return;
      }
      const { data, error } = await supabase
        .from("lesson_progress")
        .insert({ lesson_id: lessonId, user_id: session.user.id })
        .select();
      if (error) {
        console.error("Failed to save lesson progress:", error);
      } else if (data) {
        setLessonProgress((prev) => [...prev, ...data]);
      }
    },
    [session.user.id, lessonProgress],
  );

  // Save watch progress to database (progress never decreases)
  const saveWatchProgress = useCallback(
    async (lessonId: string, progress: number) => {
      if (!session.user.id || !lessonId) return;

      const existing = lessonProgress.find((p) => p.lesson_id === lessonId);
      const currentProgress = existing?.watch_progress || 0;

      // Only update if new progress is higher
      if (progress <= currentProgress) return;

      const progressData = {
        user_id: session.user.id,
        lesson_id: lessonId,
        watch_progress: progress,
      };

      const { data, error } = await supabase
        .from("lesson_progress")
        .upsert(progressData, {
          onConflict: "user_id,lesson_id",
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to save watch progress:", error);
      } else {
        // Update local state
        setLessonProgress((prev) => {
          const idx = prev.findIndex((p) => p.lesson_id === lessonId);
          if (idx === -1) return [...prev, data];
          return prev.map((p) =>
            p.lesson_id === lessonId ? { ...p, watch_progress: progress } : p,
          );
        });

        // Also save to localStorage as backup
        if (lessonId) {
          localStorage.setItem(
            `${WATCH_PROGRESS_KEY_PREFIX}${lessonId}`,
            progress.toString(),
          );
        }
      }
    },
    [session.user.id, lessonProgress],
  );

  // Save quiz score (only update if new score is higher)
  const saveQuizScore = useCallback(
    async (lessonId: string, score: number) => {
      if (!session.user.id || !lessonId) return;

      const existing = lessonProgress.find((p) => p.lesson_id === lessonId);
      const currentMaxScore = existing?.max_quiz_score || 0;

      // Only update if new score is higher
      if (score <= currentMaxScore) return;

      const scoreData = {
        user_id: session.user.id,
        lesson_id: lessonId,
        quiz_score: score,
        max_quiz_score: score,
      };

      const { data, error } = await supabase
        .from("lesson_progress")
        .upsert(scoreData, {
          onConflict: "user_id,lesson_id",
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to save quiz score:", error);
      } else {
        // Update local state
        setLessonProgress((prev) => {
          const idx = prev.findIndex((p) => p.lesson_id === lessonId);
          if (idx === -1) return [...prev, data];
          return prev.map((p) =>
            p.lesson_id === lessonId
              ? { ...p, quiz_score: score, max_quiz_score: score }
              : p,
          );
        });
      }
    },
    [session.user.id, lessonProgress],
  );

  const systemStatusRef = useRef(systemStatus);
  systemStatusRef.current = systemStatus;
  const prevSystemStatusRef = useRef(systemStatus);
  const prevScriptIndexRef = useRef(scriptIndex);

  const advanceScript = useCallback((increment = 1) => {
    if (systemStatusRef.current !== "playing") return; // Do not advance script if not playing
    setScriptIndex((prev) => prev + increment);
  }, []);

  const forceAdvanceScript = useCallback(
    (increment = 1) => {
      setScriptIndex((prev) => prev + increment);
    },
    [setScriptIndex],
  );

  const handleSpeechEnd = useCallback(() => {
    // 清除语音超时定时器
  if (speechTimeoutRef.current) {
    clearTimeout(speechTimeoutRef.current);
    speechTimeoutRef.current = null;
  }

    if (systemStatusRef.current !== "playing") return;
    setTextToSpeak("");

    // If speech was cancelled (seek / interruption), do not advance script or reveal choices.
    if (speechCancelledRef.current) {
      speechCancelledRef.current = false;
      setCaptionText("");
      return;
    }

    if (sentenceQueueRef.current.length > 0) {
      const nextSentence = sentenceQueueRef.current.shift()!;
      setTextToSpeak(nextSentence);
      setCaptionText(nextSentence);
      return;
    }

    setCaptionText("");

    if (systemStatus === "interrupted") {
      setSystemStatus("paused"); // Stay paused after interruption is handled.
      return;
    }

    if (systemStatus === "asking_question") {
      return;
    }

    // Show pending choices after speech ends
    if (pendingChoices) {
      if (pendingChoices.correctAnswers) {
        setMultiChoiceCorrectAnswers(pendingChoices.correctAnswers);
      } else {
        setMultiChoiceCorrectAnswers(null);
      }
      setInteractiveChoices(pendingChoices.options);
      setPendingChoices(null);
      return;
    }

    const lastAction = lessonScript[scriptIndex];

    if (lastAction.type === "speech") {
      if (lastAdvancedFromSpeechIndexRef.current !== scriptIndex) {
        lastAdvancedFromSpeechIndexRef.current = scriptIndex;
        advanceScript(1);
      }
    }
  }, [scriptIndex, systemStatus, advanceScript, lessonScript, pendingChoices]);

  const switchToQAMode = useCallback(() => {
    setSystemStatus("asking_question");
    const systemPrompt = `你是一位友好且知识渊博的物联网与通信工程课程助教。你刚刚通过一个脚本讲授了以下课程内容：\n\n${lessonSummary}\n\n现在，课程的脚本讲解部分已经结束。请根据以上内容，回答学生的提问。保持你的角色，并鼓励学生结合课设与专业基础思考。\n\n重要：你的所有回复都必须是 JSON 格式，且结构必须如下：\n{"type": "speech", "payload": {"text": "你的回答内容"}}`;
    const newHistory = initializeChat(systemPrompt);
    setChatHistory(newHistory);
    const qaStartMessage: Message = {
      id: crypto.randomUUID(),
      role: "model",
      content:
        "课程讲解部分结束了。关于我们今天讨论的内容，你有什么问题吗？现在可以自由提问了！",
    };
    setMessages((prev) => [...prev, qaStartMessage]);
    const sentences = qaStartMessage.content
      .split("\n")
      .filter((s) => s.trim() !== "");
    if (sentences.length > 0) {
      sentenceQueueRef.current = sentences.slice(1);
      setTextToSpeak(sentences[0]);
      setCaptionText(sentences[0]);
    }
  }, [lessonSummary]);

  const processScriptAction = useCallback(
    (action: AIAction) => {
      // Do not process most actions if not playing, EXCEPT show_quiz
      // which must always be processed (it pauses the lesson for the quiz).
      if (systemStatusRef.current !== "playing") {
        if (action.type === "command" && action.payload.name === "show_quiz") {
          // fall through — always process quiz popups
        } else {
          return;
        }
      }
      let shouldAdvance = true;
      let advanceDelay = 1000;

      // processScriptAction 内部的 case "speech":
if (action.type === "speech") {
  // 每次开始新语音时重置取消标记，防御其他路径遗留的标记
  speechCancelledRef.current = false;
  const speech = action.payload.text;
  const aiMessage: Message = {
    id: crypto.randomUUID(),
    role: "model",
    content: speech.replace(/\n/g, "\n"),
  };

  const lastMessage = messages[messages.length - 1];
  if (
    lastMessage?.role !== "model" ||
    lastMessage?.content !== aiMessage.content
  ) {
    setMessages((prev) => [...prev, aiMessage]);
  }

  const sentences = speech.split("\n").filter((s) => s.trim() !== "");
  if (sentences.length > 0) {
    sentenceQueueRef.current = sentences.slice(1);
    setTextToSpeak(sentences[0]);
    setCaptionText(sentences[0]);

    // 清除之前的超时
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
    }
    // 设置 15 秒超时，防止 TTS 无响应
    speechTimeoutRef.current = window.setTimeout(() => {
      console.warn("[StudentApp] Speech timeout – forcing advance");
      window.speechSynthesis.cancel();
      setTextToSpeak("");
      sentenceQueueRef.current = [];
      speechCancelledRef.current = false;
      // 模拟 speech end 行为
      handleSpeechEnd();
    }, 15000);
  } else {
    handleSpeechEnd();
  }

  shouldAdvance = false;
} else if (action.type === "command") {
        const { name, args = {} } = action.payload;

        switch (name) {
          case "show_pdf":
            if (args.url) {
              setBlackboardContent({
                type: "pdf",
                url: args.url,
                page: args.page ?? 1,
              });
            }
            break;
          case "show_video":
            if (args.url) {
              setBlackboardContent({ type: "video", url: args.url });
            }
            shouldAdvance = false;
            break;
          case "goto_page":
            if (args.page) {
              setBlackboardContent((c) =>
                c?.type === "pdf" ? { ...c, page: args.page! } : c,
              );
            }
            break;
          case "clear_blackboard":
            setBlackboardContent(null);
            setDrawingState({ operations: [], background: "transparent" });
            break;
          case "draw":
            if (args.operations) {
              setDrawingState((prevState) => {
                let newOps = [...prevState.operations];
                let newBg = prevState.background;
                args.operations!.forEach((op) => {
                  if (op.type === "clear") {
                    newOps = [];
                  } else if (op.type === "background") {
                    newBg = op.color;
                  } else {
                    newOps.push(op);
                  }
                });
                return { operations: newOps, background: newBg };
              });
            }
            advanceDelay = 100;
            break;
          case "present_choices":
            if (args.options) {
              // If we're not speaking anymore, show choices immediately.
              // Otherwise, defer until speech ends.
              const stillSpeaking =
                window.speechSynthesis.speaking ||
                sentenceQueueRef.current.length > 0 ||
                !!textToSpeak;
              if (stillSpeaking) {
                setPendingChoices({
                  options: args.options,
                  correctAnswers: undefined,
                });
              } else {
                setMultiChoiceCorrectAnswers(null);
                setInteractiveChoices(args.options);
                setPendingChoices(null);
              }
            }
            shouldAdvance = false;
            break;
          case "present_multi_choices":
            if (args.options) {
              const stillSpeaking =
                window.speechSynthesis.speaking ||
                sentenceQueueRef.current.length > 0 ||
                !!textToSpeak;
              if (stillSpeaking) {
                setPendingChoices({
                  options: args.options,
                  correctAnswers: args.correctAnswers,
                });
              } else {
                setMultiChoiceCorrectAnswers(args.correctAnswers ?? null);
                setInteractiveChoices(args.options);
                setPendingChoices(null);
              }
            }
            shouldAdvance = false;
            break;
          case "show_quiz": {
            const quizId = args.quizId;
            const quizType = args.type;
            const question = args.question;
            const answer = args.answer;
            if (!quizId || !quizType || !question || !answer) {
              console.warn(
                "[StudentApp] show_quiz missing required args:",
                args,
              );
              break;
            }
            // Always stop speaking and pause for the quiz popup
            window.speechSynthesis.cancel();
            setTextToSpeak("");
            sentenceQueueRef.current = [];
            // Do NOT set speechCancelledRef to true here — it would prevent
            // the next speech action from advancing after the quiz is answered.
            // Instead, just cancel the current utterance directly.
            resetAvatarState();
            setSystemStatus("paused");
            setActiveQuiz({
              quizId,
              type: quizType,
              question,
              options: args.options,
              answer,
              scoreWeight: args.scoreWeight ?? 1,
              explanationCorrect: args.explanationCorrect,
              explanationWrong: args.explanationWrong,
            });
            shouldAdvance = false;
            break;
          }
          case "complete_lesson":
            if (currentLesson) {
              completeLesson(currentLesson.id);
            }
            break;
          case "start_qa":
            switchToQAMode();
            shouldAdvance = false;
            break;
        }

        if (shouldAdvance) {
          setTimeout(() => advanceScript(), advanceDelay);
        }
      }
    },
    [
      messages,
      currentLesson,
      completeLesson,
      advanceScript,
      switchToQAMode,
      handleSpeechEnd,
      textToSpeak,
    ],
  );

  useEffect(() => {
    // Drive the lesson forward by processing the current script action.
    // Normally it runs when `scriptIndex` changes. When we paused due to a seek,
    // we also need to run once when `systemStatus` resumes to `playing`.
    const prevStatus = prevSystemStatusRef.current;
    const prevIdx = prevScriptIndexRef.current;

    // Update refs first so next render has correct "previous" values.
    prevSystemStatusRef.current = systemStatus;
    prevScriptIndexRef.current = scriptIndex;

    if (
      systemStatus !== "playing" ||
      !isSessionStarted ||
      scriptIndex >= lessonScript.length ||
      interactiveChoices ||
      pendingChoices ||
      activeQuiz
    ) {
      return;
    }

    const scriptIndexChanged = prevIdx !== scriptIndex;
    const justResumedFromPause =
      prevStatus === "paused" &&
      systemStatus === "playing" &&
      !scriptIndexChanged;

    if (justResumedFromPause) {
      if (!needsProcessOnResumeRef.current) return;
      needsProcessOnResumeRef.current = false;
    } else if (!scriptIndexChanged) {
      // Avoid re-processing the same action when resuming manually.
      return;
    }

    const currentAction = lessonScript[scriptIndex];
    processScriptAction(currentAction);
  }, [
    systemStatus,
    scriptIndex,
    isSessionStarted,
    processScriptAction,
    interactiveChoices,
    pendingChoices,
    activeQuiz,
    lessonScript,
  ]);

  const totalQuizWeight = useMemo(() => {
    const weights = lessonScript
      .filter((a) => a.type === "command" && a.payload.name === "show_quiz")
      .map((a) =>
        a.type === "command" ? (a.payload.args.scoreWeight ?? 1) : 1,
      );
    return (
      weights.reduce(
        (s, w) => s + (Number.isFinite(w) ? (w as number) : 1),
        0,
      ) || 1
    );
  }, [lessonScript]);

  // Auto-save watch progress when scriptIndex changes (index-based, monotonic)
  useEffect(() => {
    if (!isSessionStarted || lessonScript.length === 0 || !currentLesson?.id)
      return;

    const progress = ((scriptIndex + 1) / lessonScript.length) * 100;
    setCurrentWatchProgress(progress);

    // Save scriptIndex to localStorage for this specific lesson
    const storageKey = `${SCRIPT_INDEX_STORAGE_KEY_PREFIX}${currentLesson.id}`;
    localStorage.setItem(storageKey, scriptIndex.toString());

    // Save max unlocked index to database (debounced, monotonic)
    const timer = setTimeout(() => {
      const nextMax = Math.max(maxUnlockedIndex, scriptIndex);
      if (nextMax > maxUnlockedIndex && session.user.id) {
        upsertMaxProgressIndex(session.user.id, currentLesson.id, nextMax).then(
          ({ data, error }) => {
            if (error)
              console.error("Failed to save max_progress_index:", error);
            if (data) {
              setMaxUnlockedIndex(data.max_progress_index ?? nextMax);
              setStudentLessonRecords((prev) => {
                const idx = prev.findIndex(
                  (r) => r.lesson_id === currentLesson.id,
                );
                if (idx === -1) return [...prev, data as any];
                return prev.map((r) =>
                  r.lesson_id === currentLesson.id
                    ? ({ ...r, ...data } as any)
                    : r,
                );
              });
            }
          },
        );
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    scriptIndex,
    lessonScript.length,
    isSessionStarted,
    currentLesson?.id,
    maxUnlockedIndex,
    session.user.id,
  ]);

  const startLesson = useCallback(
    (lesson: Lesson, fromBeginning: boolean = true) => {
      console.log(
        `[startLesson] Starting lesson ${lesson.id}, fromBeginning=${fromBeginning}`,
      );

      resetAvatarState();
      setTextToSpeak("");
      setMessages([]);
      setInteractiveChoices(null);
      setPendingChoices(null);
      setActiveQuiz(null);
      setBlackboardContent(null);
      setDrawingState({ operations: [], background: "transparent" });
      setCaptionText("");
      sentenceQueueRef.current = [];
      lastAdvancedFromSpeechIndexRef.current = null;

      // Reset index only when explicitly starting from beginning.
      // When resuming current lesson (e.g. refresh), keep index and let restore effect load saved index.
      if (fromBeginning) {
        setScriptIndex(0);
        setMaxUnlockedIndex(0);
        setAttemptedQuizIds(new Set());
      }

      // Clear the saved progress for this lesson if starting from beginning
      if (fromBeginning) {
        const storageKey = `${SCRIPT_INDEX_STORAGE_KEY_PREFIX}${lesson.id}`;
        localStorage.removeItem(storageKey);
        console.log(
          `[startLesson] Cleared saved progress for lesson ${lesson.id}`,
        );
      }

      // Mark that we need to restore progress for this lesson
      hasRestoredProgressRef.current = false;
      currentLessonIdRef.current = lesson.id;

      setSystemStatus("paused");
      setIsSessionStarted(true);
      // ✅ 新增：显示 Toast 提示
      setToastMessage("课程已准备就绪，点击 ▶ 开始学习");
      setTimeout(() => setToastMessage(null), 3000); // 3 秒后自动消失

      // Reset quiz tracking for new lesson
      setCurrentLessonQuizScore(0);
      setCurrentLessonTotalQuestions(0);
    },
    [
      resetAvatarState,
      setMessages,
      setInteractiveChoices,
      setPendingChoices,
      setBlackboardContent,
      setDrawingState,
      setCaptionText,
      setIsSessionStarted,
    ],
  );

  const handleChoiceSelected = useCallback(
    (choice: string) => {
      setInteractiveChoices(null);
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: choice,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

      const choiceAction = lessonScript[scriptIndex] as Extract<
        AIAction,
        { type: "command" }
      >;
      const { correctAnswer } = choiceAction.payload.args;

      if (correctAnswer !== undefined) {
        // This is a scored choice — submit to student_lesson_records
        setCurrentLessonTotalQuestions((prev) => prev + 1);
        const isCorrect = choice === correctAnswer;
        if (isCorrect) {
          setCurrentLessonQuizScore((prev) => prev + 1);
        }
        // Submit quiz attempt to the correct table (student_lesson_records)
        if (currentLesson?.id && session.user.id) {
          const totalQuestions = currentLessonTotalQuestions + 1;
          const earned = isCorrect ? 100 / totalQuestions : 0;
          submitQuizAttempt({
            userId: session.user.id,
            lessonId: currentLesson.id,
            quizId: `choice_${scriptIndex}`,
            earnedScore: earned,
          }).then(async () => {
            const { data: after } = await fetchStudentLessonRecord(
              session.user.id,
              currentLesson.id,
            );
            if (after) {
              setStudentLessonRecords((prev) => {
                const idx = prev.findIndex(
                  (r) => r.lesson_id === currentLesson.id,
                );
                if (idx === -1) return [...prev, after as any];
                return prev.map((r) =>
                  r.lesson_id === currentLesson.id
                    ? ({ ...r, ...after } as any)
                    : r,
                );
              });
            }
          });
        }
        advanceScript(isCorrect ? 1 : 2);
      } else {
        // Non-scored choice (voting / interaction) — just advance, no score
        advanceScript(1);
      }
      setMultiChoiceCorrectAnswers(null);
    },
    [
      scriptIndex,
      advanceScript,
      setInteractiveChoices,
      setMessages,
      lessonScript,
      currentLesson?.id,
      currentLessonTotalQuestions,
      currentLessonQuizScore,
      session.user.id,
    ],
  );

  const rebuildBoardStateUntilIndex = useCallback(
    (targetIndex: number) => {
      let nextBlackboard: BlackboardContent = null;
      let nextDrawing: {
        operations: DrawingOperation[];
        background: "black" | "white" | "transparent";
      } = {
        operations: [],
        background: "transparent",
      };

      for (let i = 0; i <= targetIndex; i++) {
        const action = lessonScript[i];
        if (!action || action.type !== "command") continue;
        const { name, args = {} } = action.payload;
        switch (name) {
          case "show_pdf":
            if (args.url)
              nextBlackboard = {
                type: "pdf",
                url: args.url,
                page: args.page ?? 1,
              };
            break;
          case "goto_page":
            if (args.page && nextBlackboard?.type === "pdf") {
              nextBlackboard = {
                type: "pdf",
                url: nextBlackboard.url,
                page: args.page,
              };
            }
            break;
          case "show_video":
            if (args.url) nextBlackboard = { type: "video", url: args.url };
            break;
          case "clear_blackboard":
            nextBlackboard = null;
            nextDrawing = { operations: [], background: "transparent" };
            break;
          case "draw":
            if (args.operations) {
              let ops = [...nextDrawing.operations];
              let bg = nextDrawing.background;
              args.operations.forEach((op) => {
                if (op.type === "clear") ops = [];
                else if (op.type === "background") bg = op.color;
                else ops.push(op);
              });
              nextDrawing = { operations: ops, background: bg };
            }
            break;
        }
      }

      setBlackboardContent(nextBlackboard);
      setDrawingState(nextDrawing);
    },
    [lessonScript, setBlackboardContent, setDrawingState],
  );

  const handleSeekScript = useCallback(
    (newIndex: number) => {
      if (lessonScript.length === 0) return;
      const maxIndex = Math.max(0, lessonScript.length - 1);
      if (newIndex < 0 || newIndex > maxIndex) return;
      const lockedIndex = Math.min(newIndex, maxUnlockedIndex, maxIndex);

      // 停止当前语音
      stopSpeaking();
      // 重置取消标记，确保 resume 后的新语音不会被当作"被取消的语音"而跳过推进
      speechCancelledRef.current = false;

      // 清理状态
      setInteractiveChoices(null);
      setPendingChoices(null);
      setMultiChoiceCorrectAnswers(null);
      setActiveQuiz(null);
      lastAdvancedFromSpeechIndexRef.current = null;
      rebuildBoardStateUntilIndex(lockedIndex);
      setCaptionText("");
      sentenceQueueRef.current = [];
      setScriptIndex(lockedIndex);

      // Seek always pauses; user must click “继续” to start the next action.
      needsProcessOnResumeRef.current = true;
      setSystemStatus("paused");
    },
    [
      stopSpeaking,
      setInteractiveChoices,
      setPendingChoices,
      setMultiChoiceCorrectAnswers,
      setActiveQuiz,
      setCaptionText,
      setScriptIndex,
      setSystemStatus,
      lessonScript,
      maxUnlockedIndex,
      rebuildBoardStateUntilIndex,
    ],
  );

  const handleMultiChoiceSubmit = useCallback(
    (choices: string[]) => {
      setInteractiveChoices(null);
      const label = choices.join("、");
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: label,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

      if (multiChoiceCorrectAnswers !== null) {
        // Scored multi-choice — submit to student_lesson_records
        setCurrentLessonTotalQuestions((prev) => prev + 1);
        const correct =
          multiChoiceCorrectAnswers.every((a) => choices.includes(a)) &&
          choices.every((c) => multiChoiceCorrectAnswers.includes(c));
        if (correct) {
          setCurrentLessonQuizScore((prev) => prev + 1);
        }
        // Submit quiz attempt to the correct table (student_lesson_records)
        if (currentLesson?.id && session.user.id) {
          const totalQuestions = currentLessonTotalQuestions + 1;
          const earned = correct ? 100 / totalQuestions : 0;
          submitQuizAttempt({
            userId: session.user.id,
            lessonId: currentLesson.id,
            quizId: `multi_choice_${scriptIndex}`,
            earnedScore: earned,
          }).then(async () => {
            const { data: after } = await fetchStudentLessonRecord(
              session.user.id,
              currentLesson.id,
            );
            if (after) {
              setStudentLessonRecords((prev) => {
                const idx = prev.findIndex(
                  (r) => r.lesson_id === currentLesson.id,
                );
                if (idx === -1) return [...prev, after as any];
                return prev.map((r) =>
                  r.lesson_id === currentLesson.id
                    ? ({ ...r, ...after } as any)
                    : r,
                );
              });
            }
          });
        }
        advanceScript(correct ? 1 : 2);
      } else {
        // Non-scored multi-choice (voting / interaction) — just advance, no score
        advanceScript(1);
      }
      setMultiChoiceCorrectAnswers(null);
    },
    [
      scriptIndex,
      advanceScript,
      setInteractiveChoices,
      setMessages,
      lessonScript,
      multiChoiceCorrectAnswers,
      currentLesson?.id,
      currentLessonTotalQuestions,
      currentLessonQuizScore,
      session.user.id,
    ],
  );

  const handleSkipQuestion = useCallback(() => {
    setInteractiveChoices(null);
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: "跳过",
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // 跳过题目时，跳过答案讲解部分
    // 通常答案讲解在题目前面1-2个位置（正确答案和错误答案的讲解）
    // 所以需要跳到下一个非讲解内容
    let skipToIndex = scriptIndex + 1;
    while (skipToIndex < lessonScript.length) {
      const nextAction = lessonScript[skipToIndex];
      // 跳过所有答案讲解的speech（通常包含"若选"、"正确"等关键词）
      if (
        nextAction.type === "speech" &&
        (nextAction.payload.text.includes("若选") ||
          nextAction.payload.text.includes("对。"))
      ) {
        skipToIndex++;
      } else if (nextAction.type === "command") {
        // 找到下一个命令，跳出答案讲解部分
        break;
      } else {
        break;
      }
    }
    setScriptIndex(Math.min(skipToIndex, lessonScript.length - 1));
    setMultiChoiceCorrectAnswers(null);
  }, [
    scriptIndex,
    setInteractiveChoices,
    setMessages,
    setScriptIndex,
    lessonScript,
    setMultiChoiceCorrectAnswers,
  ]);

  const handleSendMessage = useCallback(
    async (userInput: string) => {
      if (!userInput.trim() || !chatHistory || isLoading) return;

      setIsLoading(true);
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: userInput,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const { newHistory, response: aiAction } = await sendMessageToAI(
          chatHistory,
          userInput,
        );
        setChatHistory(newHistory);

        if (aiAction.type === "speech") {
          const speech = aiAction.payload.text;
          const aiMessage: Message = {
            id: crypto.randomUUID(),
            role: "model",
            content: speech.replace(/\\n/g, "\n"),
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, aiMessage]);

          const sentences = speech.split("\n").filter((s) => s.trim() !== "");
          if (sentences.length > 0) {
            sentenceQueueRef.current = sentences.slice(1);
            setTextToSpeak(sentences[0]);
            setCaptionText(sentences[0]);
          }
        } else {
          console.warn(
            "[StudentApp] Received an unexpected command in Q&A mode:",
            aiAction,
          );
        }
      } catch (error) {
        console.error("发送消息失败:", error);
        const errorMessage =
          error instanceof Error ? error.message : "发生未知错误。";
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "model",
            content: `抱歉，我遇到了一个错误。请重试。 ${errorMessage}`,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [chatHistory, isLoading],
  );

  const handleStudentMessage = useCallback(
    async (userInput: string) => {
      if (systemStatus === "asking_question") {
        await handleSendMessage(userInput);
        return;
      }

      // Interruption logic
      stopSpeaking();
      setSystemStatus("interrupted");

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: userInput,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

      setIsLoading(true);
      try {
        const interruptionSystemPrompt = `You are a helpful AI tutor. The student has interrupted the current lesson to ask a question. The lesson summary is: ${lessonSummary}. Answer the student's question clearly and concisely. After answering, do not ask a follow-up question. Your response must be in JSON format: {"type": "speech", "payload": {"text": "Your answer"}}`;
        const interruptionHistory = initializeChat(interruptionSystemPrompt);
        const { response: aiAction } = await sendMessageToAI(
          interruptionHistory,
          userInput,
        );

        if (aiAction.type === "speech") {
          const speech = aiAction.payload.text;
          const aiMessage: Message = {
            id: crypto.randomUUID(),
            role: "model",
            content: speech,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, aiMessage]);

          const sentences = speech.split("\n").filter((s) => s.trim() !== "");
          if (sentences.length > 0) {
            sentenceQueueRef.current = sentences.slice(1);
            setTextToSpeak(sentences[0]);
            setCaptionText(sentences[0]);
          }
        }
      } catch (error) {
        console.error("Failed to handle interruption:", error);
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred.";
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "model",
            content: `Sorry, I ran into an error. Please try again. ${errorMessage}`,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [systemStatus, handleSendMessage, stopSpeaking],
  );

  // 从数据库加载课程分类和课程列表
  const fetchCourses = useCallback(async () => {
    const { data, error } = await supabase
      .from("course_categories")
      .select(`*, lessons (*)`);

    if (error) {
      console.error("Error fetching courses:", error);
    } else if (data) {
      setCourseCategories(data as CourseCategory[]);
      // Only set to first lesson if no lesson is currently selected
      setCurrentLesson((prev) => {
        if (!prev && data.length > 0 && data[0].lessons?.length > 0) {
          return data[0].lessons[0];
        }
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    fetchCourses();

    // Load lesson progress from database
    const loadLessonProgress = async () => {
      if (session.user.id) {
        // Legacy table (used by older UI parts)
        const { data, error } = await supabase
          .from("lesson_progress")
          .select("*")
          .eq("user_id", session.user.id);
        if (!error && data) setLessonProgress(data);

        // New student lesson records (progress index + quiz total)
        const { data: records, error: recErr } = await supabase
          .from("student_lesson_records")
          .select("*")
          .eq("user_id", session.user.id);
        if (recErr) {
          console.error("Failed to load student_lesson_records:", recErr);
        } else if (records) {
          setStudentLessonRecords(records as any);
        }
      }
    };

    loadLessonProgress();
  }, [session.user.id, fetchCourses]);

  // Resume lesson after page refresh if session was already started
  useEffect(() => {
    if (
      isSessionStarted &&
      currentLesson &&
      lessonScript.length > 0 &&
      scriptIndex === 0
    ) {
      // Check if there's saved progress for this lesson
      const storageKey = `${SCRIPT_INDEX_STORAGE_KEY_PREFIX}${currentLesson.id}`;
      const savedIndex = localStorage.getItem(storageKey);
      if (savedIndex !== null && parseInt(savedIndex, 10) > 0) {
        console.log(
          `[StudentApp] Resuming lesson ${currentLesson.id} from saved progress`,
        );
        // Progress will be restored by the other useEffect
      }
    }
  }, [isSessionStarted, currentLesson?.id, lessonScript.length]);

  // Load max unlocked index for current lesson, then restore scriptIndex
  useEffect(() => {
    const run = async () => {
      if (!session.user.id || !currentLesson?.id || lessonScript.length === 0)
        return;

      console.log(
        `[Progress Restore] Checking lesson ${currentLesson.id}, scriptIndex=${scriptIndex}, hasRestored=${hasRestoredProgressRef.current}`,
      );

      // Detect lesson change
      if (currentLessonIdRef.current !== currentLesson.id) {
        console.log(
          `[Progress Restore] Lesson changed from ${currentLessonIdRef.current} to ${currentLesson.id}, resetting restore flag`,
        );
        hasRestoredProgressRef.current = false;
        currentLessonIdRef.current = currentLesson.id;
      }

      const { data, error } = await fetchStudentLessonRecord(
        session.user.id,
        currentLesson.id,
      );
      if (error) {
        console.error("Failed to load student_lesson_records:", error);
        return;
      }
      const attempts = (data?.quiz_attempts as any) ?? {};
      const attempted = new Set<string>(Object.keys(attempts));
      setAttemptedQuizIds(attempted);

      const dbMax = Math.min(
        Math.max(0, data?.max_progress_index ?? 0),
        Math.max(0, lessonScript.length - 1),
      );
      // Hard lock: never allow unlocking past the first unattempted quiz.
      const firstBlockingQuizIndex = (() => {
        for (let i = 0; i < lessonScript.length; i++) {
          const a = lessonScript[i];
          if (a.type === "command" && a.payload.name === "show_quiz") {
            const qid = a.payload.args.quizId;
            if (qid && !attempted.has(qid)) return i;
          }
        }
        return null;
      })();
      const effectiveMax =
        firstBlockingQuizIndex !== null
          ? Math.min(dbMax, firstBlockingQuizIndex)
          : dbMax;

      setMaxUnlockedIndex(effectiveMax);
      console.log(`[Progress Restore] Set maxUnlockedIndex to ${effectiveMax}`);

      // Restore scriptIndex from localStorage (only once per lesson, and only if session started)
      if (!hasRestoredProgressRef.current && isSessionStarted) {
        const storageKey = `${SCRIPT_INDEX_STORAGE_KEY_PREFIX}${currentLesson.id}`;
        const savedIndex = localStorage.getItem(storageKey);

        if (savedIndex !== null) {
          const parsedIndex = parseInt(savedIndex, 10);
          if (
            !isNaN(parsedIndex) &&
            parsedIndex > 0 &&
            parsedIndex < lessonScript.length
          ) {
            const restoredIndex = Math.min(parsedIndex, effectiveMax);
            console.log(
              `[Progress Restore] Restoring scriptIndex from ${scriptIndex} to ${restoredIndex} for lesson ${currentLesson.id}`,
            );
            setScriptIndex(restoredIndex);
            hasRestoredProgressRef.current = true;
          } else {
            console.log(
              `[Progress Restore] Invalid saved index ${parsedIndex}, keeping scriptIndex at ${scriptIndex}`,
            );
            hasRestoredProgressRef.current = true;
          }
        } else {
          console.log(
            `[Progress Restore] No saved progress found for lesson ${currentLesson.id}`,
          );
          hasRestoredProgressRef.current = true;
        }
      }
    };
    run();
  }, [
    session.user.id,
    currentLesson?.id,
    lessonScript.length,
    isSessionStarted,
  ]);

  const handleVideoEnded = useCallback(() => {
    // Always clear the video from blackboard when it ends, regardless of status
    setBlackboardContent((prev) => {
      if (prev?.type === "video") return null;
      return prev;
    });

    if (systemStatusRef.current !== "playing") return;

    const action = lessonScript[scriptIndex];
    if (action?.type === "command" && action.payload.name === "show_video") {
      forceAdvanceScript(1);
    }
  }, [lessonScript, scriptIndex, forceAdvanceScript, setBlackboardContent]);

  const handleSelectLesson = (lesson: Lesson) => {
    if (currentLesson?.id === lesson.id && isSessionStarted) {
      setIsCourseSelectorOpen(false);
      return;
    }
    setCurrentLesson(lesson);
    setIsCourseSelectorOpen(false);

    // When switching to a different lesson, start from beginning
    // so each lesson has independent timeline.
    startLesson(lesson, true);
  };
useEffect(() => {
  return () => {
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
    }
  };
}, []);
  // Keep session alive across refresh without forcing reset to first sentence.
  useEffect(() => {
    if (!isSessionStarted || !currentLesson) return;
    // Resume current lesson state after refresh.
    startLesson(currentLesson, false);

    // After refresh, nothing is actually playing (speech, video, etc. are all dead).
    // Set to paused so the user can explicitly resume and trigger re-processing.
    needsProcessOnResumeRef.current = true;
    setSystemStatus("paused");

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause/resume with page visibility to avoid accidental full replay/reload-like behavior.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (!isSessionStarted) return;
      if (document.hidden) {
        if (systemStatusRef.current === "playing") {
          visibilityPausedRef.current = true;
          // Stop speech synthesis when page is hidden (Chrome may silently kill it anyway)
          window.speechSynthesis.cancel();
          setTextToSpeak("");
          sentenceQueueRef.current = [];
          pauseLesson();
        }
      } else if (visibilityPausedRef.current) {
        visibilityPausedRef.current = false;
        resumeLesson();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isSessionStarted]);

  const getPlaceholderText = () => {
    if (!isSessionStarted) return "请先从左侧菜单选择一门课程";
    if (interactiveChoices) return "请从下方的选项中选择";

    switch (systemStatus) {
      case "playing":
        return '讲课中... 您可以"举手提问"或"暂停"';
      case "paused":
        return '已暂停，点击"继续"可恢复播放';
      case "asking_question":
        return "请打字或者语音输入您的问题...";
      case "interrupted":
        return "正在处理您的问题...";
      default:
        return "准备开始...";
    }
  };

  // 拖拽调节面板宽度
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingLeft && !isDraggingRight) return;

      const container = document.querySelector(
        ".flex.flex-1.min-h-0",
      ) as HTMLElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const x = e.clientX - containerRect.left;
      const containerWidth = containerRect.width;

      if (isDraggingLeft) {
        // 调节左侧面板宽度
        const newWidth = (x / containerWidth) * 100;
        // 限制在 15% - 25% 之间
        const clampedWidth = Math.max(15, Math.min(25, newWidth));
        setLeftPanelWidth(clampedWidth);
      } else if (isDraggingRight) {
        // 调节右侧面板宽度
        const newWidth =
          ((containerRect.right - e.clientX) / containerWidth) * 100;
        // 限制在 15% - 25% 之间
        const clampedWidth = Math.max(15, Math.min(25, newWidth));
        setRightPanelWidth(clampedWidth);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingLeft || isDraggingRight) {
        setIsDraggingLeft(false);
        setIsDraggingRight(false);
      }
    };

    if (isDraggingLeft || isDraggingRight) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      // 防止选中文本
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    };
  }, [isDraggingLeft, isDraggingRight]);

  const getStatusDisplay = () => {
    if (!isSessionStarted) return null;

    let text = "";
    let color = "text-slate-400";
    let bgColor = "bg-slate-800";

    switch (systemStatus) {
      case "playing":
        text = "上课中";
        color = "text-green-300";
        bgColor = "bg-green-900/50";
        break;
      case "paused":
        text = "休息中";
        color = "text-yellow-300";
        bgColor = "bg-yellow-900/50";
        break;
      case "asking_question":
        text = "提问中";
        color = "text-cyan-300";
        bgColor = "bg-cyan-900/50";
        break;
      case "interrupted":
        text = "思考中...";
        color = "text-orange-300";
        bgColor = "bg-orange-900/50";
        break;
      default:
        return null;
    }

    return (
      <div
        className={`absolute top-5 left-1/2 translate-x-[calc(-50%+50px)] px-3 py-1 text-xs font-semibold rounded-full ${color} ${bgColor} backdrop-blur-sm shadow-lg z-50`}
      >
        {text}
      </div>
    );
  };

  // Progress bar works in *progress index* space (speech + video actions count as progress).
  const currentProgressIdx = scriptIndexToProgressIndex(scriptIndex);
  const seekPreviewProgressIdx =
    seekPreviewIndex !== null
      ? scriptIndexToProgressIndex(seekPreviewIndex)
      : null;
  const progressBarProgressIdx = seekPreviewProgressIdx ?? currentProgressIdx;
  const totalSteps = Math.max(1, progressIndices.length);
  // Use Math.ceil to ensure 100% when all steps are completed (fixes 99% bug)
  const completedProgressPct = Math.min(
    100,
    Math.ceil((progressBarProgressIdx / Math.max(1, totalSteps - 1)) * 100),
  );
  const unlockedProgressIdx = scriptIndexToProgressIndex(maxUnlockedIndex);
  const unlockedProgressPct = Math.min(
    100,
    Math.ceil((unlockedProgressIdx / Math.max(1, totalSteps - 1)) * 100),
  );

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white font-sans relative">
      {getStatusDisplay()}
      {/* Toast 提示 */}
      {toastMessage && (
        <div className="absolute bottom-6 left-[56%] -translate-x-1/2 z-50 px-6 py-3 bg-cyan-600 text-white text-xs font-medium rounded-full shadow-lg animate-bounce">
          {toastMessage}
        </div>
      )}
      {activeQuiz && (
        <QuizCard
          quiz={activeQuiz}
          isSubmitting={isQuizSubmitting}
          onSubmit={async (selectedIndexes) => {
            if (!session.user.id || !currentLesson?.id) return;
            setIsQuizSubmitting(true);
            try {
              const isCorrect =
                selectedIndexes.length === activeQuiz.answer.length &&
                activeQuiz.answer.every((a) => selectedIndexes.includes(a));
              const earned = isCorrect
                ? Math.ceil(
                    100 * ((activeQuiz.scoreWeight ?? 1) / totalQuizWeight),
                  )
                : 0;
              const { error } = await submitQuizAttempt({
                userId: session.user.id,
                lessonId: currentLesson.id,
                quizId: activeQuiz.quizId,
                earnedScore: earned,
              });
              if (error) console.error("Failed to submit quiz:", error);
              const { data: after, error: readAfterErr } =
                await fetchStudentLessonRecord(
                  session.user.id,
                  currentLesson.id,
                );
              if (!readAfterErr && after) {
                setStudentLessonRecords((prev) => {
                  const idx = prev.findIndex(
                    (r) => r.lesson_id === currentLesson.id,
                  );
                  if (idx === -1) return [...prev, after as any];
                  return prev.map((r) =>
                    r.lesson_id === currentLesson.id
                      ? ({ ...r, ...after } as any)
                      : r,
                  );
                });
              }
              setAttemptedQuizIds((prev) => {
                const next = new Set(prev);
                next.add(activeQuiz.quizId);
                return next;
              });
            } finally {
              setIsQuizSubmitting(false);
            }
          }}
          onContinue={() => {
            setActiveQuiz(null);
            setInteractiveChoices(null);
            setPendingChoices(null);
            setMultiChoiceCorrectAnswers(null);
            forceAdvanceScript(1);
            // 利用当前按钮点击手势激活音频上下文，避免浏览器自动播放限制导致长时间延迟
            const dummy = new SpeechSynthesisUtterance("");
            dummy.volume = 0;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(dummy);
            needsProcessOnResumeRef.current = true;
            setSystemStatus("playing");
          }}
        />
      )}
      {showAvatarCreator && (
        <AvatarCreator
          onAvatarExported={(url) => {
            setAvatarUrl(url);
            localStorage.setItem(AVATAR_STORAGE_KEY, url);
            setShowAvatarCreator(false);
          }}
          onClose={() => setShowAvatarCreator(false)}
        />
      )}
      {isHelpModalOpen && (
        <HelpModal onClose={() => setIsHelpModalOpen(false)} />
      )}
      {isChangePasswordModalOpen && (
        <ChangePasswordModal onClose={() => setIsChangePasswordModalOpen(false)} />
      )}
      <CourseSelector
        isOpen={isCourseSelectorOpen}
        onClose={() => setIsCourseSelectorOpen(false)}
        categories={courseCategories}
        currentLessonId={currentLesson?.id || ""}
        onSelectLesson={handleSelectLesson}
        studentLessonRecords={studentLessonRecords}
      />

      {!isSessionStarted && (
        <div className="absolute inset-0 bg-slate-900 bg-opacity-90 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
          <h2 className="text-3xl font-bold text-cyan-400 mb-4">
            欢迎使用交互式 AI 导师
          </h2>
          <p className="text-slate-300 mb-8 text-lg">
            点击下方按钮开始您的学习之旅。
          </p>
          <button
            onClick={() => {
              if (currentLesson) {
                startLesson(currentLesson, false);
              } else {
                setIsSessionStarted(true);
                setSystemStatus("paused");
              }
            }}
            className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-8 rounded-lg transition-all text-lg shadow-lg transform hover:scale-105"
          >
            开始课程
          </button>
        </div>
      )}

      <header className="p-4 shadow-md text-center border-b border-slate-700 flex-shrink-0 bg-slate-800">
        <div className="flex justify-between items-center w-full">
          <button
            onClick={() => setIsCourseSelectorOpen(true)}
            className="p-2"
            aria-label="选择课程"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <div className="text-center">
            <h1 className="text-xl font-bold text-cyan-400">
              {currentLesson?.title || "交互式 AI 导师"}
            </h1>
            <p className="text-slate-400 text-sm">
              {currentLesson?.description || "请选择一门课程"}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {/* Volume Control */}
            <div className="flex items-center space-x-1 text-slate-300 p-2" title="调节音量">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 pointer-events-none"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                aria-label="音量"
              />
            </div>

            {/* Speech Rate Control */}
            <div className="flex items-center space-x-1 text-slate-300 p-2" title="调节语速">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 pointer-events-none"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M4.555 5.168A1 1 0 003 6.118v7.764a1 1 0 001.555.832l4.333-2.889a1 1 0 000-1.664L4.555 5.168zM10.555 5.168A1 1 0 009 6.118v7.764a1 1 0 001.555.832l4.333-2.889a1 1 0 000-1.664l-4.333-2.889z" />
              </svg>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.25"
                value={speechRate}
                onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                className="w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                aria-label="语速"
              />
            </div>
            <button
              onClick={() => setIsHistoryVisible((v) => !v)}
              className="p-2"
              aria-label="显示/隐藏对话历史"
              title="显示/隐藏对话历史"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 5.523-4.477 10-10 10S1 17.523 1 12 5.477 2 11 2s10 4.477 10 10z"
                />
              </svg>
            </button>
            <button
              onClick={() => setIsHelpModalOpen(true)}
              className="p-2"
              aria-label="应用介绍"
              title="应用介绍"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            <button
              onClick={() => setShowAvatarCreator(true)}
              className="p-2 hidden"
              aria-label="自定义形象"
              title="自定义形象"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 pointer-events-none"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
            {/* User Info Hover */}
            <div className="relative group">
              <button
                className="p-2"
                aria-label="用户信息"
                title="用户信息"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 pointer-events-none"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </button>
              {/* Hover card */}
              <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-600 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none group-hover:pointer-events-auto">
                <div className="p-4 space-y-2">
                  <div className="flex items-center space-x-3 pb-2 border-b border-slate-600">
                    <div className="w-10 h-10 rounded-full bg-cyan-600 flex items-center justify-center text-white font-bold text-lg">
                      {(profile?.student_name || profile?.email || "U").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{profile?.student_name || "未设置姓名"}</p>
                      <p className="text-xs text-slate-400">{profile?.role === 'student' ? '学生' : profile?.role === 'teacher' ? '教师' : '未知身份'}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                      <span className="text-xs text-slate-300 truncate">{profile?.email || session?.user?.email || "未设置"}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                      </svg>
                      <span className="text-xs text-slate-300">班号：{profile?.class_number || "未设置"}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                      </svg>
                      <span className="text-xs text-slate-300">学号：{profile?.student_id || "未设置"}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                        <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
                      </svg>
                      <span className="text-xs text-slate-300">身份：{profile?.role === 'student' ? '学生' : profile?.role === 'teacher' ? '教师' : '未知'}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-600">
                    <button
                      onClick={() => setIsChangePasswordModalOpen(true)}
                      className="w-full px-3 py-2 text-sm text-cyan-400 hover:bg-slate-700 rounded-md transition-colors flex items-center justify-center space-x-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      <span>修改密码</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                if (window.confirm("确定要退出登录吗？")) {
                  supabase.auth.signOut();
                }
              }}
              className="p-2"
              aria-label="登出"
              title="退出登录"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Column 1: Left (Avatar + Caption) */}
        <div
          className="hidden md:flex flex-col bg-slate-950 border-r border-slate-800"
          style={{
            width: `${leftPanelWidth}%`,
            minWidth: "15%",
            maxWidth: "25%",
          }}
        >
          {isSessionStarted && (
            <div className="flex-grow min-h-0">
              <InteractiveAvatar
                avatarUrl={avatarUrl}
                textToSpeak={textToSpeak}
                onSpeechEnd={handleSpeechEnd}
              />
            </div>
          )}
          {isSessionStarted && (
            <div className="flex-shrink-0 p-4 border-t border-slate-700">
              <div className="h-48 w-full overflow-y-auto whitespace-pre-wrap bg-slate-900 p-2 rounded-md">
                <p className="text-yellow-400">{captionText}</p>
              </div>
            </div>
          )}
        </div>

        {/* Left Resizer */}
        <div
          className="hidden md:flex w-1 bg-slate-700 hover:bg-cyan-500 cursor-col-resize transition-colors z-10"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDraggingLeft(true);
          }}
          style={{ minWidth: "4px" }}
        />

        {/* Column 2: Middle (Blackboard + ChatInput) */}
        <div
          className="flex flex-col bg-slate-900"
          style={{ flex: 1, minWidth: "50%" }}
        >
          <main className="flex-1 flex flex-col items-center justify-center p-2 bg-slate-900 min-h-0">
            {isSessionStarted && !currentLesson ? (
              <div className="flex flex-col items-center justify-center gap-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="text-slate-500 text-xl font-medium">暂无课程数据</p>
                <p className="text-slate-600 text-sm">请从左侧菜单选择一门课程</p>
              </div>
            ) : (
              <Blackboard
                content={blackboardContent}
                drawingState={drawingState}
                onPageChange={(page) =>
                  setBlackboardContent((c) =>
                    c?.type === "pdf" ? { ...c, page } : c,
                  )
                }
                onVideoEnded={handleVideoEnded}
                isPaused={systemStatus !== "playing"}
              />
            )}
          </main>
          {isSessionStarted && (
            <footer className="flex-shrink-0 p-2 bg-slate-900">
              {interactiveChoices ? (
                <InteractiveChoices
                  choices={interactiveChoices}
                  onChoiceSelected={handleChoiceSelected}
                  multiCorrectAnswers={multiChoiceCorrectAnswers}
                  onMultiChoiceSubmit={handleMultiChoiceSubmit}
                  onSkip={handleSkipQuestion}
                />
              ) : (
                <ChatInput
                  onSendMessage={handleStudentMessage}
                  onMicStart={stopSpeaking}
                  isLoading={isLoading}
                  isDisabled={systemStatus !== "asking_question"}
                  placeholder={getPlaceholderText()}
                />
              )}
              {/* Progress Bar */}
              {isSessionStarted && lessonScript.length > 0 && (
                <div className="w-full mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">课程进度</span>
                    <span className="text-xs text-slate-400">
                      进度 {currentProgressIdx + 1} / {totalSteps}（已解锁至{" "}
                      {unlockedProgressIdx + 1}）
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <button
                      onClick={() => handleSeekScript(0)}
                      className="p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                      aria-label="回到开头"
                      title="回到开头"
                      disabled={scriptIndex <= 0}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 pointer-events-none"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z"
                        />
                      </svg>
                    </button>
                    <div className="flex-1 mx-2 relative h-2 bg-slate-700 rounded-lg overflow-hidden">
                      <input
                        type="range"
                        min="0"
                        max={totalSteps - 1}
                        value={progressBarProgressIdx}
                        onChange={(e) => {
                          const newProgressIdx = parseInt(e.target.value);
                          if (!Number.isNaN(newProgressIdx)) {
                            // Map progress index back to script index for the preview
                            setSeekPreviewIndex(
                              progressIndexToScriptIndex(newProgressIdx),
                            );
                          }
                        }}
                        onPointerUp={(e) => {
                          if (seekCommitGuardRef.current) return;
                          seekCommitGuardRef.current = true;
                          const pIdx = parseInt(e.currentTarget.value);
                          const commitIndex = progressIndexToScriptIndex(pIdx);
                          if (
                            !Number.isNaN(commitIndex) &&
                            commitIndex !== scriptIndex
                          )
                            handleSeekScript(commitIndex);
                          setSeekPreviewIndex(null);
                          setTimeout(() => {
                            seekCommitGuardRef.current = false;
                          }, 0);
                        }}
                        onMouseUp={(e) => {
                          if (seekCommitGuardRef.current) return;
                          seekCommitGuardRef.current = true;
                          const pIdx = parseInt(e.currentTarget.value);
                          const commitIndex = progressIndexToScriptIndex(pIdx);
                          if (
                            !Number.isNaN(commitIndex) &&
                            commitIndex !== scriptIndex
                          )
                            handleSeekScript(commitIndex);
                          setSeekPreviewIndex(null);
                          setTimeout(() => {
                            seekCommitGuardRef.current = false;
                          }, 0);
                        }}
                        onTouchEnd={(e) => {
                          if (seekCommitGuardRef.current) return;
                          seekCommitGuardRef.current = true;
                          const pIdx = parseInt(e.currentTarget.value);
                          const commitIndex = progressIndexToScriptIndex(pIdx);
                          if (
                            !Number.isNaN(commitIndex) &&
                            commitIndex !== scriptIndex
                          )
                            handleSeekScript(commitIndex);
                          setSeekPreviewIndex(null);
                          setTimeout(() => {
                            seekCommitGuardRef.current = false;
                          }, 0);
                        }}
                        onPointerCancel={() => setSeekPreviewIndex(null)}
                        onBlur={() => setSeekPreviewIndex(null)}
                        onKeyUp={() => {
                          const commitIndex = seekPreviewIndex ?? scriptIndex;
                          if (commitIndex !== scriptIndex)
                            handleSeekScript(commitIndex);
                          setSeekPreviewIndex(null);
                        }}
                        className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10"
                        aria-label="课程进度"
                      />
                      <div
                        className="absolute top-0 left-0 h-full bg-white/15 pointer-events-none"
                        style={{ width: `${unlockedProgressPct}%` }}
                      />
                      <div
                        className="absolute top-0 left-0 h-full bg-cyan-500 rounded-lg transition-all pointer-events-none"
                        style={{ width: `${completedProgressPct}%` }}
                      />
                    </div>
                    <button
                      onClick={() =>
                        handleSeekScript(
                          Math.min(maxUnlockedIndex, scriptIndex + 10),
                        )
                      }
                      className="p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                      aria-label="前进10步"
                      title="前进10步"
                      disabled={scriptIndex >= maxUnlockedIndex}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 pointer-events-none"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-center items-center space-x-6 mt-2">
                {/* Ask Question Button */}
                <button
                  onClick={() => {
                    stopSpeaking();
                    const qaSystemPrompt = `你是一位友好且知识渊博的物联网与通信工程课程助教。学生在课程中途暂停并向你提问。课程的整体内容摘要如下：\n\n${lessonSummary}\n\n请根据学生的问题进行清晰、简洁的回答。回答完毕后，不要主动追问，等待学生继续课程。你的所有回复都必须是 JSON 格式，且结构必须如下：\n{"type": "speech", "payload": {"text": "你的回答内容"}}`;
                    const newHistory = initializeChat(qaSystemPrompt);
                    setChatHistory(newHistory);
                    setSystemStatus("asking_question");
                  }}
                  className="flex flex-col items-center text-slate-300 hover:text-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="举手提问"
                  disabled={
                    !isSessionStarted || systemStatus === "asking_question"
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-8 w-8"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18.5 13.5C18.5 12.0373 18.0307 10.642 17.2091 9.51851C16.3876 8.39502 15.2653 7.60863 14 7.29999V5.5C14 4.96956 13.7893 4.46085 13.4142 4.08578C13.0391 3.71071 12.5304 3.49999 12 3.49999C11.4696 3.49999 10.9609 3.71071 10.5858 4.08578C10.2107 4.46085 10 4.96956 10 5.5V10.5C10 11.0304 10.2107 11.5391 10.5858 11.9142C10.9609 12.2893 11.4696 12.5 12 12.5C12.5304 12.5 13.0391 12.2893 13.4142 11.9142C13.7893 11.5391 14 11.0304 14 10.5V9.33999C14.8011 9.58417 15.511 10.0397 16.0556 10.6556C16.5993 11.2704 16.9583 12.0197 17.1 12.8L14 12.2C13.4696 12.2 12.9609 12.4107 12.5858 12.7858C12.2107 13.1609 12 13.6696 12 14.2V19.2C12 19.7304 12.2107 20.2391 12.5858 20.6142C12.9609 20.9893 13.4696 21.2 14 21.2H16.5C17.5913 21.2 18.637 20.7679 19.412 19.9929C20.187 19.2179 20.619 18.1722 20.619 17.081C20.619 15.603 19.713 14.245 18.5 13.5ZM6.5 1.49999C5.50261 1.49999 4.54602 1.89508 3.84099 2.59012C3.13595 3.28515 2.74087 4.24174 2.74087 5.23912V11.2391C2.74087 12.2365 3.13595 13.1931 3.84099 13.8881C4.54602 14.5832 5.50261 14.9783 6.5 14.9783C7.49739 14.9783 8.45398 14.5832 9.15901 13.8881C9.86405 13.1931 10.2591 12.2365 10.2591 11.2391V5.23912C10.2591 4.24174 9.86405 3.28515 9.15901 2.59012C8.45398 1.89508 7.49739 1.49999 6.5 1.49999Z" />
                  </svg>
                  <span className="text-xs mt-1">举手提问</span>
                </button>

                {/* Pause/Continue Button */}
                <button
                  onClick={() =>
                    systemStatus === "playing" ? pauseLesson() : resumeLesson()
                  }
                  className="p-3 rounded-full text-slate-300 bg-slate-700 hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={
                    systemStatus === "playing" ? "暂停课程" : "继续课程"
                  }
                  disabled={!isSessionStarted}
                >
                  {systemStatus === "playing" ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10 9v6m4-6v6"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </footer>
          )}
        </div>

        {/* Middle Resizer */}
        <div
          className="hidden md:flex w-1 bg-slate-700 hover:bg-cyan-500 cursor-col-resize transition-colors z-10"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDraggingRight(true);
          }}
          style={{ minWidth: "4px" }}
        />

        {/* Column 3: Right (ChatWindow only) */}
        <aside
          className="hidden md:flex flex-col bg-slate-800 transition-all duration-300 ease-in-out border-l border-slate-700"
          style={{
            width: isHistoryVisible ? `${rightPanelWidth}%` : "0%",
            minWidth: isHistoryVisible ? "15%" : "0",
            maxWidth: isHistoryVisible ? "25%" : "0",
          }}
        >
          {isHistoryVisible && (
            <ChatWindow messages={messages} isLoading={isLoading} />
          )}
        </aside>
      </div>
    </div>
  );
};
