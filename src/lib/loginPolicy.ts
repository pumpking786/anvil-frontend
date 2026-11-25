export const LOGIN_FAILURE_LIMIT = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
export const LOGIN_POLICY_TEXT =
  'After 5 failed sign-in attempts within 15 minutes, the account is blocked for 15 minutes.';

export type LoginState = {
  failures: number;
  firstFailure: number;
  lockedUntil: number;
};
export type LoginAttemptState = LoginState;

export function loginBlocked(state: LoginState | null | undefined, now = Date.now()) {
  return (state?.lockedUntil || 0) > now;
}

export function failedLogin(state: LoginState | null | undefined, now = Date.now()): LoginState {
  if (loginBlocked(state, now)) return state!;
  const fresh = !state || state.lockedUntil > 0 || now - state.firstFailure >= LOGIN_WINDOW_MS;
  const failures = fresh ? 1 : state.failures + 1;
  return {
    failures,
    firstFailure: fresh ? now : state.firstFailure,
    lockedUntil: failures >= LOGIN_FAILURE_LIMIT ? now + LOGIN_LOCK_MS : 0,
  };
}

export function loginBlockError(state: LoginState, now = Date.now()) {
  const seconds = Math.max(1, Math.ceil((state.lockedUntil - now) / 1000));
  return Object.assign(
    new Error(
      `Account temporarily blocked after repeated failed verification attempts. Try again in ${Math.ceil(seconds / 60)} minute${seconds > 60 ? 's' : ''}, or ask your administrator to unlock it.`,
    ),
    { status: 423, retryAfter: seconds, lockedUntil: state.lockedUntil },
  );
}
