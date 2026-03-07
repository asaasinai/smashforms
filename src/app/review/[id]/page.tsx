import { ReviewPage } from "@/components/review/review-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReviewPage id={id} />;
}
