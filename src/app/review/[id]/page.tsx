import { ReviewPage } from "@/components/review/review-page";

type ReviewDetailPageProps = {
  params: { id: string };
};

export const dynamic = "force-dynamic";

export default function ReviewDetailPage({ params }: ReviewDetailPageProps) {
  return <ReviewPage reviewId={params.id} />;
}
