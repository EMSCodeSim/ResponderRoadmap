import { isDemoAvailable } from "@/server/demo";
import { PublicSeoPage, seoMetadata } from "@/components/public-seo-page";
import { publicPageByPath } from "@/lib/public-pages";

const page = publicPageByPath("/driver-operator-task-books");
export const metadata = seoMetadata(page);

export default async function Page() {
  return <PublicSeoPage page={page} demoAvailable={await isDemoAvailable()} />;
}
