import { cookies } from "next/headers";

export type ServerSession = {
  email?: string;
};

export const readServerSession = async (): Promise<ServerSession | null> => {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("gray-auth");
  const emailCookie = cookieStore.get("gray-auth-email");



  if (!authCookie || !emailCookie?.value) {
    return null;
  }

  let email: string | undefined;
  if (emailCookie.value) {
    try {
      email = decodeURIComponent(emailCookie.value);
    } catch {
      email = emailCookie.value;
    }
  }

  if (!email || email.trim().length === 0) {
    return null;
  }

  return { email };
};
