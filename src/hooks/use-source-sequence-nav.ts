import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdjacentSources } from "@/lib/adjacent-sources.functions";
import type { ReaderNav } from "@/components/source-reader";
import {
  resolveSourceSequenceFromLeaves,
  sequenceNavLabels,
  type LibraryLeaf,
} from "@/lib/library-sequence";

type Options = {
  lang: "he" | "en";
  /** When opening from library browse, pass the current folder's leaves to avoid a server round-trip. */
  localLeaves?: LibraryLeaf[];
  /** Parent browse path — used for position label context. */
  browsePath?: string[];
  onNavigate: (sourceId: string) => void;
  loading?: boolean;
};

export function useSourceSequenceNav(
  sourceId: string | null,
  { lang, localLeaves, browsePath = [], onNavigate, loading }: Options,
): ReaderNav | undefined {
  const fn = useServerFn(getAdjacentSources);
  const useServer = !!sourceId && !localLeaves?.length;

  const { data: sequence, isFetching, isError } = useQuery({
    queryKey: ["adjacent-sources", sourceId],
    queryFn: () => fn({ data: { sourceId: sourceId! } }),
    enabled: useServer,
    staleTime: 60_000,
    retry: false,
  });

  return useMemo(() => {
    if (!sourceId) return undefined;

    const resolved =
      localLeaves && localLeaves.length > 0
        ? resolveSourceSequenceFromLeaves(localLeaves, sourceId, browsePath)
        : isError
          ? null
          : (sequence ?? null);

    if (!resolved) return undefined;

    const labels = sequenceNavLabels(resolved.kind, lang);
    const position =
      lang === "he"
        ? `${resolved.current.index} מתוך ${resolved.current.total}`
        : `${resolved.current.index} of ${resolved.current.total}`;

    return {
      label: resolved.current.label,
      subtitle: position,
      onPrev: resolved.prev ? () => onNavigate(resolved.prev!.id) : () => undefined,
      onNext: resolved.next ? () => onNavigate(resolved.next!.id) : () => undefined,
      canPrev: !!resolved.prev,
      canNext: !!resolved.next,
      prevLabel: labels.prev,
      nextLabel: labels.next,
      loading: loading || (useServer && isFetching),
    };
  }, [
    sourceId,
    localLeaves,
    browsePath,
    sequence,
    lang,
    onNavigate,
    loading,
    useServer,
    isFetching,
    isError,
  ]);
}

/** Build ReaderNav for daily study date navigation. */
export function buildDailyReaderNav(options: {
  lang: "he" | "en";
  label: string;
  onPrev: () => void;
  onNext: () => void;
  canNext?: boolean;
  canPrev?: boolean;
  onToday?: () => void;
  todayLabel?: string;
  loading?: boolean;
}): ReaderNav {
  const labels = sequenceNavLabels("day", options.lang);
  return {
    label: options.label,
    onPrev: options.onPrev,
    onNext: options.onNext,
    canPrev: options.canPrev,
    canNext: options.canNext,
    onToday: options.onToday,
    todayLabel: options.todayLabel,
    prevLabel: labels.prev,
    nextLabel: labels.next,
    loading: options.loading,
  };
}
