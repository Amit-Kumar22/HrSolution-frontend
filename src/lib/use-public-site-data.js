"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCompanyProfile,
  getIndustries,
  getManpowerCategories,
  getServices,
  getTestimonials,
  sortByDisplayOrder,
} from "./publicApi";

function messageOf(error, fallback) {
  const message = error && typeof error.message === "string" ? error.message.trim() : "";
  return message || fallback;
}

const INITIAL_STATE = {
  loading: true,
  profile: null,
  profileError: null,
  industries: [],
  industriesError: null,
  services: [],
  servicesError: null,
  categories: [],
  categoriesError: null,
  testimonials: [],
  testimonialsError: null,
};

export default function usePublicSiteData() {
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;

    const settle = async (key, promise) => {
      try {
        const value = await promise;
        return { key, value };
      } catch (error) {
        return { key, error };
      }
    };

    Promise.all([
      settle("profile", getCompanyProfile()),
      settle("industries", getIndustries()),
      settle("services", getServices()),
      settle("categories", getManpowerCategories()),
      settle("testimonials", getTestimonials()),
    ]).then((results) => {
      if (cancelled) return;
      const byKey = Object.fromEntries(results.map((entry) => [entry.key, entry]));

      setState({
        loading: false,
        profile: byKey.profile.error ? null : byKey.profile.value,
        profileError: byKey.profile.error
          ? messageOf(byKey.profile.error, "Company details are currently unavailable.")
          : null,
        industries: byKey.industries.error ? [] : byKey.industries.value,
        industriesError: byKey.industries.error
          ? messageOf(byKey.industries.error, "Industries could not be loaded.")
          : null,
        services: byKey.services.error ? [] : byKey.services.value,
        servicesError: byKey.services.error
          ? messageOf(byKey.services.error, "Services could not be loaded.")
          : null,
        categories: byKey.categories.error ? [] : byKey.categories.value,
        categoriesError: byKey.categories.error
          ? messageOf(byKey.categories.error, "Manpower categories could not be loaded.")
          : null,
        testimonials: byKey.testimonials.error ? [] : byKey.testimonials.value,
        testimonialsError: byKey.testimonials.error
          ? messageOf(byKey.testimonials.error, "Testimonials could not be loaded.")
          : null,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true }));
    setReloadToken((token) => token + 1);
  }, []);

  const services = useMemo(() => sortByDisplayOrder(state.services), [state.services]);
  const industries = useMemo(() => sortByDisplayOrder(state.industries), [state.industries]);

  return useMemo(
    () => ({ ...state, services, industries, reload }),
    [state, services, industries, reload],
  );
}
