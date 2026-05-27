"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { readSession } from "./session";

export function RedirectIfLoggedIn() {
  const router = useRouter();
  useEffect(() => {
    if (readSession()) router.replace("/dashboard");
  }, [router]);
  return null;
}

export function RedirectIfNotLoggedIn() {
  const router = useRouter();
  useEffect(() => {
    if (!readSession()) router.replace("/login");
  }, [router]);
  return null;
}
