import WorkerPortal from "@/components/worker-portal";
import "./worker.css";

export const metadata = {
  title: "Worker Portal | Shakti Manpower",
  description: "View your worker profile, deployment history and account settings.",
};

export default function WorkerPage() {
  return <WorkerPortal />;
}
