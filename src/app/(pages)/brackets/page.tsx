import { getServerAuthSession } from "~/server/auth";
import BracketsClient from "./_components/BracketsClient";

export default async function BracketsPage() {
  const session = await getServerAuthSession();

  return <BracketsClient userRole={session?.user?.role} />;
}
