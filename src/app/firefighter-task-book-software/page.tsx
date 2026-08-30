import { isDemoAvailable } from "@/server/demo";
import { PublicSeoPage, seoMetadata } from "@/components/public-seo-page";
import { publicPageByPath } from "@/lib/public-pages";

const page = publicPageByPath("/firefighter-task-book-software");
export const metadata = seoMetadata(page);

export default async function Page() {
  return <PublicSeoPage page={page} demoAvailable={await isDemoAvailable()} />;
}
