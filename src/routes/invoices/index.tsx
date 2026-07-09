import { createFileRoute } from "@tanstack/react-router";
import { DocumentListPage, EmptyInvoiceIcon } from "@/components/DocumentListPage";

export const Route = createFileRoute("/invoices/")({
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
        { label: "Draft", status: "draft" },
        { label: "Issued", status: "issued" },
        { label: "Paid", status: "paid" },
        { label: "Archived", status: "archived" },
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
