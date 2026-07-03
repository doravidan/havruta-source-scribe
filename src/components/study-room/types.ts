import type { getStudySession } from "@/lib/chavruta-study.functions";

export type StudyBundle = Awaited<ReturnType<typeof getStudySession>>;
export type StudyProgressRow = StudyBundle["progress"][number];
export type StudyQuestionRow = StudyBundle["questions"][number];
export type StudyMessageRow = StudyBundle["messages"][number];
export type StudyLang = "he" | "en";
