import { PropertiesClient } from "@/components/properties/properties-client";
import { SAMPLE_PROPERTIES } from "@/lib/design/sample-data";

export default function PropertiesPreviewPage() {
  return <PropertiesClient properties={SAMPLE_PROPERTIES} />;
}
