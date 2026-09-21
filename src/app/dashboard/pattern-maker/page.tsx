import PatternMakerApp from "@/components/pattern-maker/PatternMakerApp";

export const metadata = {
  title: "Pattern Maker | MCUSTOCK AI",
  description: "Create seamless textile patterns, cutting maps, mockups, and production exports.",
};

export default function DashboardPatternMakerPage() {
  return <div className="pattern-maker-route h-[calc(100vh-7rem)] min-h-[620px] w-full overflow-hidden bg-background text-foreground"><PatternMakerApp /></div>;
}