/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '@supabase/auth-js' {
  export type User = {
    id: string;
    email?: string;
    user_metadata?: Record<string, any>;
    app_metadata?: Record<string, any>;
    [key: string]: any;
  };

  export type Session = {
    access_token: string;
    refresh_token?: string;
    provider_token?: string | null;
    user?: User | null;
    expires_at?: number;
    expires_in?: number;
    token_type?: string;
  };

  export class AuthError extends Error {
    status?: number;
    code?: string;
  }

  export class AuthApiError extends AuthError {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string);
  }

  export class AuthClient {
    signInWithOAuth(options: any): Promise<{ data: { url?: string | null }; error: AuthError | null }>;
    signInWithPassword(options: any): Promise<{ data: { session?: Session | null; user?: User | null }; error: AuthError | null }>;
    signUp(options: any): Promise<{ data: { session?: Session | null; user?: User | null }; error: AuthError | null }>;
    resend(options: any): Promise<{ data?: any; error: AuthError | null }>;
    resetPasswordForEmail(email: string, options?: any): Promise<{ data?: any; error: AuthError | null }>;
    updateUser(attributes: any): Promise<{ data?: { user?: User | null }; error: AuthError | null }>;
    exchangeCodeForSession(
      authCode: string
    ): Promise<{ data: { session: Session | null; user: User | null }; error: AuthError | null }>;
    setSession(params: {
      access_token: string;
      refresh_token: string;
    }): Promise<{ data: { session: Session | null; user: User | null }; error: AuthError | null }>;
    getSession(): Promise<{ data: { session: Session | null }; error: AuthError | null }>;
    getUser(): Promise<{ data: { user: User | null }; error: AuthError | null }>;
    signOut(options?: { scope?: string }): Promise<{ error: AuthError | null }>;
    onAuthStateChange(
      callback: (event: string, session: Session | null) => void
    ): { data: { subscription: { unsubscribe(): void } } };
  }

  export { AuthClient as GoTrueClient };
  export const GoTrueAdminApi: any;
  export const AuthAdminApi: any;
}
