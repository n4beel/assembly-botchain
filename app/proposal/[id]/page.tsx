import PageShell from "@/components/layout/PageShell";
import ProposalView from "@/components/assembly/ProposalView";
import { NAV } from "@/lib/nav";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProposalPage({ params }: PageProps) {
  const { id } = await params;
  const proposalId = BigInt(id);

  return (
    <PageShell
      nav={NAV}
      title={`Proposal #${id}`}
      description={`View and vote on proposal #${id} on BOT Chain`}
    >
      <ProposalView id={proposalId} />
    </PageShell>
  );
}
