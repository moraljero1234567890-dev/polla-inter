export type SeedUser = {
  email: string;
  nit: string;
  name: string;
};

export const seedUsers: SeedUser[] = [
  {
    email: "userad@example.com",
    nit: "1234567890",
    name: "Cliente Demo",
  },
  {
    email: "demo@grupointer.com",
    nit: "9001234567",
    name: "Demo Grupo Inter",
  },
  {
    email: "asesor@grupointer.com",
    nit: "8001112223",
    name: "Asesor Inter",
  },
];

export function findUser(email: string, nit: string): SeedUser | null {
  const e = email.trim().toLowerCase();
  const n = nit.replace(/\D/g, "");
  return (
    seedUsers.find(
      (u) => u.email.toLowerCase() === e && u.nit === n,
    ) ?? null
  );
}
