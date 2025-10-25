import { cookies } from "next/headers";

export type ServerSession = {
  email?: string;
};

export const readServerSession = async (): Promise<ServerSession | null> => {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("gray-auth");

  if (!authCookie) {
    return null;
  }

  const emailCookie = cookieStore.get("gray-auth-email");
  let email: string | undefined;
  if (emailCookie?.value) {
    try {
      email = decodeURIComponent(emailCookie.value);
    } catch {
      email = emailCookie.value;
    }
  }

  return { email };
};
