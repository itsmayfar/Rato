/** Result returned by every server action used with `useActionState`. */
export type ActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Optional payload (e.g. id of a created record). */
  data?: Record<string, unknown>;
};

export const ok = (message?: string, data?: Record<string, unknown>): ActionState => ({ ok: true, message, data });
export const fail = (message: string, errors?: Record<string, string>): ActionState => ({ ok: false, message, errors });
