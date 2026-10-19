import PageShell from "@/components/layout/PageShell";
import { NAV } from "@/lib/nav";
import { app } from "@/lib/app-config";
import ProposeForm from "@/components/assembly/ProposeForm";

export default function Home() {
  return (
    <PageShell nav={NAV} title={app.name} description={app.tagline}>
      <ProposeForm />
    </PageShell>
  );
}
