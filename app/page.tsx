import { redirect } from "next/navigation";

// The Library is the home screen. Signed-out visitors never get this far:
// the proxy sends them to the sign-in page first.
export default function Home() {
  redirect("/library");
}
