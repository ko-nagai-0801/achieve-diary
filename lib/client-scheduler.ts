/* lib/client-scheduler.ts */
export type CancelFn = () => void;

type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type RequestIdleCallbackLike = (cb: (deadline: IdleDeadlineLike) => void, opts?: { timeout?: number }) => number;
type CancelIdleCallbackLike = (id: number) => void;

export function runIdle(cb: () => void, timeoutMs = 700): CancelFn {
  if (typeof window === "undefined") return () => {};

  const w = window as unknown as {
    requestIdleCallback?: RequestIdleCallbackLike;
    cancelIdleCallback?: CancelIdleCallbackLike;
  };

  if (typeof w.requestIdleCallback === "function") {
    const id = w.requestIdleCallback(() => cb(), { timeout: timeoutMs });
    return () => {
      if (typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(id);
    };
  }

  const t = window.setTimeout(cb, 0);
  return () => window.clearTimeout(t);
}
