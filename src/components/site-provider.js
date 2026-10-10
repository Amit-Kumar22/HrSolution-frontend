"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import usePublicSiteData from "@/lib/use-public-site-data";
import EnquiryModal from "./enquiry-modal";

const SiteContext = createContext(null);

export function SiteProvider({ children }) {
  const site = usePublicSiteData();
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  const openEnquiry = useCallback(() => setEnquiryOpen(true), []);
  const closeEnquiry = useCallback(() => setEnquiryOpen(false), []);

  const value = useMemo(
    () => ({ ...site, enquiryOpen, openEnquiry, closeEnquiry }),
    [site, enquiryOpen, openEnquiry, closeEnquiry],
  );

  return (
    <SiteContext.Provider value={value}>
      {children}
      <EnquiryModal
        open={enquiryOpen}
        onClose={closeEnquiry}
        categories={site.categories}
        categoriesLoading={site.loading}
      />
    </SiteContext.Provider>
  );
}

export function useSite() {
  const context = useContext(SiteContext);
  if (!context) throw new Error("useSite must be used inside a SiteProvider");
  return context;
}
