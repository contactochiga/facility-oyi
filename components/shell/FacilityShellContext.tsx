"use client";

import { createContext, useContext, type ReactNode } from "react";

const FacilityShellContext = createContext<{ openMenu: () => void } | null>(
  null
);

export function FacilityShellProvider({
  children,
  openMenu,
}: {
  children: ReactNode;
  openMenu: () => void;
}) {
  return (
    <FacilityShellContext.Provider value={{ openMenu }}>
      {children}
    </FacilityShellContext.Provider>
  );
}

export function useFacilityShell() {
  return useContext(FacilityShellContext);
}
