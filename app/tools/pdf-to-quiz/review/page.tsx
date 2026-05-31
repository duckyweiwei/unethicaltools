import { ReviewClient } from "./ReviewClient";

export const metadata = {
  title: "Review quiz — PDF → Quiz",
};

// Hydrates from the uploaded quiz (sessionStorage); falls back to the sample.
export default function ReviewPage() {
  return <ReviewClient />;
}
