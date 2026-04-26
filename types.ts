// FIX: Add a side-effect import for React.
// This ensures that React's global JSX namespace is loaded before we attempt to augment it.
// Without this, our augmentation would overwrite the base definition, causing all standard
// JSX elements (like `div`) and react-three-fiber elements to be unrecognized.
// FIX: Changed the side-effect import to a full import to more reliably load React's global JSX types before augmentation.
import React from 'react';
// FIX: Corrected the JSX type augmentation for react-three-fiber. The previous namespace import
// (`import * as ...`) was failing. Switched to a direct import for `ThreeElements`.
// Using a regular import instead of `import type` helps ensure that build tools do not
// strip this file, which is critical for applying the global JSX namespace augmentation.
import { ThreeElements } from '@react-three/fiber';
// FIX: Changed all `import type` to regular `import` statements.
// When a file that provides global augmentations contains only type imports,
// some build tools may strip the file, causing the augmentations to be ignored.
// Using regular imports ensures this module is always processed, allowing the JSX
// namespace augmentation for react-three-fiber to apply correctly project-wide.
import { Euler } from "three";
import { AudioProcessor } from "./lib/AudioProcessor";


// FIX: Commented out the manual global augmentation for JSX.IntrinsicElements.
// This was overwriting the default types from React and conflicting with
// react-three-fiber's own augmentation, causing all JSX elements to be unrecognized.
// Removing this allows the libraries' built-in typings to work as expected.
/*
declare global {
  namespace JSX {
    // FIX: Use the directly imported `ThreeElements` type to extend intrinsic elements.
    interface IntrinsicElements extends ThreeElements {}
  }
}
*/


export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string | number;
}

export type BlackboardContent = {
  type: 'pdf';
  url: string;
  page: number;
} | {
  type: 'video';
  url: string;
} | null;

export type DrawingOperation = {
  type: 'text';
  text: string; // LaTeX format
  x: number; // percentage
  y: number; // percentage
  color?: string;
  fontSize?: number; // in pixels
  displayMode?: boolean; // Whether to render as display math (true) or inline math (false)
} | {
  type: 'line';
  x1: number; y1: number; // percentages
  x2: number; y2: number; // percentages
  color?: string;
  lineWidth?: number;
} | {
  type: 'circle';
  cx: number; cy: number; // percentages
  radius: number; // percentage of the smaller container dimension (width or height)
  color?: string;
  lineWidth?: number;
  fill?: string;
} | {
  type: 'rect';
  x: number; y: number; // percentages
  width: number; height: number; // percentages
  color?: string;
  lineWidth?: number;
  fill?: string;
} | {
    type: 'clear';
} | {
    type: 'background';
    color: 'black' | 'white' | 'transparent';
};

// REFACTOR: Replaced the complex AIResponse/AICommand structure with a single, streamlined AIAction type.
// The AI will now return one action object at a time, making the lesson flow sequential and easier to manage.
export type AIAction = {
  type: 'speech';
  payload: {
    text: string;
  };
} | {
  type: 'command';
  payload: {
    name: 'show_pdf' | 'goto_page' | 'show_video' | 'present_choices' | 'present_multi_choices' | 'show_quiz' | 'clear_blackboard' | 'complete_lesson' | 'start_qa' | 'draw';
    // Use a flexible args object for different commands.
    args: {
      url?: string;
      page?: number;
      options?: string[];
      correctAnswer?: string;       // for single-choice / true-false
      correctAnswers?: string[];    // for multi-choice (present_multi_choices)
      operations?: DrawingOperation[];
      // show_quiz
      quizId?: string;
      type?: 'single' | 'multiple' | 'boolean';
      question?: string;
      answer?: number[]; // option indexes
      scoreWeight?: number;
      explanationCorrect?: string;
      explanationWrong?: string;
    };
  };
};

export interface Lesson {
  id: string; // uuid from Supabase
  category_id: string;
  sort_order: number;
  title: string;
  description: string;
  lesson_summary: string;
  system_prompt: string;
}

// Represents the data needed to create or update a lesson
export type LessonData = Omit<Lesson, 'id' | 'category_id'>;


export interface CourseCategory {
  id: string; // uuid from Supabase
  name: string;
  lessons: Lesson[];
}

export interface Profile {
  id: string; // uuid from auth.users
  role: 'student' | 'teacher';
  email?: string; // User's email, optional for backwards compatibility
  student_id?: string; // 学号（学生注册时填写，不可修改）
  student_name?: string; // 姓名（学生注册时填写，不可修改）
}

export interface LessonProgress {
  id?: string;
  user_id: string;
  lesson_id: string;
  watch_progress?: number;
  quiz_score?: number;
  max_quiz_score?: number;
  completed_at: string;
  updated_at?: string;
}


export enum VISEMES {
  sil = "viseme_sil",
  PP = "viseme_PP",
  FF = "viseme_FF",
  TH = "viseme_TH",
  DD = "viseme_DD",
  kk = "viseme_kk",
  CH = "viseme_CH",
  SS = "viseme_SS",
  nn = "viseme_nn",
  RR = "viseme_RR",
  aa = "viseme_aa",
  E = "viseme_E",
  I = "viseme_I",
  O = "viseme_O",
  U = "viseme_U",
}

export type Blendshapes = { [key: string]: number };

export interface AppState {
  isRecording: boolean;
  isReady: boolean;
  isSpeaking: boolean;
  // FIX: Corrected typo 'Audio-Processor' to 'AudioProcessor'.
  // The hyphen caused a major parsing error, leading to a cascade of
  // incorrect type-checking errors across the application.
  audioProcessor: AudioProcessor | null;
  blendshapes: Blendshapes;
  isMuted: boolean;
  volume: number;
  speechRate: number;
  error: string | null;
  isTestAudioPlaying: boolean;
  uploadedAudioFile: File | null;
  isDebugAnimationRunning: boolean;
  activeDebugViseme: string | null;
  availableBlendshapes: string[];
  isSpeakingSentence: boolean;
  headBobOffset: Euler;
  setHeadBobOffset: (offset: Euler) => void;

  startRecording: () => Promise<void>;
  stopRecording: () => void;
  playTestAudio: () => Promise<void>;
  speakSentence: (text: string) => Promise<void>;
  setUploadedAudio: (file: File) => void;
  runDebugAnimation: () => void;
  setBlendshapes: (blendshapes: Blendshapes) => void;
  setIsReady: (isReady: boolean) => void;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  setSpeechRate: (rate: number) => void;
  setError: (error: string | null) => void;
  setAvailableBlendshapes: (names: string[]) => void;
  resetAvatarState: () => void;
}