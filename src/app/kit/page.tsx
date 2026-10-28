import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import KitEditor from "@/components/kit/KitEditor";

export const metadata: Metadata = {
  title: "Kits for makers | Bygga",
  description: "Ship your assembly manual as a 3D guide: write one kit file and get a step by step guide with voice, print and a link to share or embed.",
  alternates: { canonical: "/kit" },
};

export default function Page() {
  return (
    <div className="site">
      <SiteHeader />
      <main>
        <KitEditor />
      </main>
      <SiteFooter />
    </div>
  );
}
