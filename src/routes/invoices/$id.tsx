import { createFileRoute } from "@tanstack/react-router";
import { DocumentDetailPage } from "@/components/DocumentDetailPage";

export const Route = createFileRoute("/invoices/$id")({
  head: () => ({
    meta: [{ title: "Invoice — ContractorOS" }],
  }),
  component: InvoiceDetailRoute,
});

function InvoiceDetailRoute() {
  const { id } = Route.useParams();
  return <DocumentDetailPage documentType="invoice" id={id} />;
}
