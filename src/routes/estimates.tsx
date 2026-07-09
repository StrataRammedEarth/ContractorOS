import { createFileRoute } from "@tanstack/react-router";
import { DocumentListPage, EmptyEstimateIcon } from "@/components/DocumentListPage";

export const Route = createFileRoute("/estimates")({
  head: () => ({
    meta: [{ title: "Estimates — ContractorOS" }],
  }),
  component: EstimatesPage,
});

function EstimatesPage() {
  return (
    <DocumentListPage
      documentType="quote"
      activeDrawerKey="quotes"
      pageTitle="Estimates"
      newButtonLabel="New Estimate"
      pills={[
        { label: "All", status: null },
        { label: "Draft", status: "draft" },
        { label: "Sent", status: "sent" },
        { label: "Accepted", status: "accepted" },
        { label: "Declined", status: "declined" },
      ]}
      searchPlaceholder="Search estimates by reference, project, or client…"
      emptyIcon={<EmptyEstimateIcon />}
      emptyTitle="No estimates found"
      emptyBody="Create your first estimate to get started."
      emptyCtaLabel="+ New Estimate"
      emptyCtaTo="/plumbing"
      emptyCtaSearch={{ doc: "quote" }}
    />
  );
}
