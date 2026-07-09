import { createFileRoute } from "@tanstack/react-router";
import { DocumentListPage, EmptyInvoiceIcon } from "@/components/DocumentListPage";

export const Route = createFileRoute("/invoices")({
  head: () => ({
    meta: [{ title: "Invoices — ContractorOS" }],
  }),
  component: InvoicesPage,
});

function InvoicesPage() {
  return (
    <DocumentListPage
      documentType="invoice"
      activeDrawerKey="invoices"
      pageTitle="Invoices"
      newButtonLabel="New Invoice"
      pills={[
        { label: "All", status: null },
        { label: "Unpaid", status: "unpaid" },
        { label: "Partial", status: "partial" },
        { label: "Paid", status: "paid" },
        { label: "Overdue", status: "overdue" },
      ]}
      searchPlaceholder="Search invoices by reference, project, or client…"
      emptyIcon={<EmptyInvoiceIcon />}
      emptyTitle="No invoices found"
      emptyBody="Create your first invoice to get started."
      emptyCtaLabel="+ New Invoice"
      emptyCtaTo="/plumbing"
      emptyCtaSearch={{ doc: "invoice" }}
    />
  );
}
