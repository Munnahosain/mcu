import { redirect } from "next/navigation";

export default function LiveTradingChartsRedirect() {
  redirect("/dashboard/trading");
}
