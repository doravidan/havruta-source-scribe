import { useRouterState } from "@tanstack/react-router";
import { safeRedirect } from "./safe-redirect";

/** TanStack Router search object for returning to the current page after sign-in. */
export function authRedirectSearch(pathname: string, searchStr = "") {
  return { redirect: safeRedirect(`${pathname}${searchStr}`) };
}

export function useAuthRedirectSearch() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  return authRedirectSearch(pathname, searchStr);
}
