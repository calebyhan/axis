import { MuscleLookupClient } from "@/components/log/MuscleLookupClient";

export const metadata = {
  title: "Muscle Lookup - Axis",
  description: "Look up exercise muscle targets and workout history.",
};

export default function MuscleLookupPage() {
  return <MuscleLookupClient />;
}
