import { redirect } from 'next/navigation';

export default function AdminPricingRedirect() {
  redirect('/admin/plans');
}
