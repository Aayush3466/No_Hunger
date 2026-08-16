export interface FormState {
  error?: string;
  fields?: Record<string, string>;
  notice?: string;
}

export const EMPTY_FORM_STATE: FormState = {};