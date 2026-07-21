import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

// Hash a plain-text password (async)
export async function hashPassword(plainPassword: string): Promise<string> {
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

// Verify a plain-text password against a hash (async)
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  try {
    // If the stored password is already a bcrypt hash (starts with $2), verify it
    if (hashedPassword.startsWith('$2')) {
      return await bcrypt.compare(plainPassword, hashedPassword);
    }
    // Backward compatibility: if still plain text, do direct comparison (will be migrated on next save)
    return plainPassword === hashedPassword;
  } catch {
    return false;
  }
}

// Sync version for cases where async isn't convenient (login flow)
export function hashPasswordSync(plainPassword: string): string {
  return bcrypt.hashSync(plainPassword, SALT_ROUNDS);
}

export function verifyPasswordSync(plainPassword: string, hashedPassword: string): boolean {
  try {
    if (hashedPassword.startsWith('$2')) {
      return bcrypt.compareSync(plainPassword, hashedPassword);
    }
    return plainPassword === hashedPassword;
  } catch {
    return false;
  }
}
