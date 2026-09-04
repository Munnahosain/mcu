import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log In | MCUSTOCK AI",
  description: "Log in to your MCUSTOCK AI account.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
