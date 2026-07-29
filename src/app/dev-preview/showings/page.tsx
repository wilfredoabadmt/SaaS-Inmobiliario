import { ShowingsList } from "@/components/showings/showings-list";
import { SAMPLE_VISITS } from "@/lib/design/sample-data";

export default function ShowingsPreviewPage() {
  return <ShowingsList visits={SAMPLE_VISITS} />;
}
