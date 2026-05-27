export type SeedUser = {
  email: string;
  password: string;
  name: string;
};

export const seedUsers: SeedUser[] = [
  {
    email: "demo@grupointer.com",
    password: "inter2026",
    name: "Usuario Demo",
  },
];

export function findUser(email: string, password: string): SeedUser | null {
  const e = email.trim().toLowerCase();
  const p = password.trim();
  return (
    seedUsers.find(
      (u) => u.email.toLowerCase() === e && u.password === p,
    ) ?? null
  );
}
