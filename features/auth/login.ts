import { findUserByEmail } from "@/entities/user/repository";
import { createSession } from "@/entities/session/repository";
import { toPublicUser, type PublicUser } from "@/entities/user/dto";
import { verifyPassword } from "@/features/auth/password";
import { parseDevice } from "@/features/auth/device";
import { generateMockIp } from "@/features/auth/mock-ip";
import type { LoginInput } from "@/entities/auth/requests";
import type { Session } from "@/entities/session/schema";

export interface LoginMeta {
  userAgent: string | null;
}

export interface LoginResult {
  user: PublicUser;
  session: Session;
}

export async function login(input: LoginInput, meta: LoginMeta): Promise<LoginResult | null> {
  const user = await findUserByEmail(input.email);
  if (!user || !verifyPassword(user.passwordHash, input.password)) {
    return null;
  }

  const session = await createSession({
    userId: user.id,
    ip: generateMockIp(),
    device: parseDevice(meta.userAgent),
    rememberMe: input.rememberMe,
  });

  return { user: toPublicUser(user), session };
}
