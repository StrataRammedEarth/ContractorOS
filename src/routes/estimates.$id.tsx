import { createFileRoute } from "@tanstack/react-router";
import { DocumentDetailPage } from "@/components/DocumentDetailPage";

export const Route = createFileRoute("/estimates/$id")({
  head: () => ({
    meta: [{ title: "Estimate — ContractorOS" }],
  }),
  component: EstimateDetailRoute,
});

function EstimateDetailRoute() {
  const { id } = Route.useParams();
  return <DocumentDetailPage documentType="quote" id={id} />;
}
