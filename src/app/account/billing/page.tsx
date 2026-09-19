import { redirect } from "next/navigation";

export default function AccountBillingRedirect() {
  redirect("/dashboard/billing");
}
