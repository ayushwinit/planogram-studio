import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/dal";

// /editor is just a landing — push the user to the Browse list. They can
// jump from there to "New Planogram" or click an existing one.
export default async function EditorIndexPage() {
  await requireSession();
  redirect("/editor/browse");
}
