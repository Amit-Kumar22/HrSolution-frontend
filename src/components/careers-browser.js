"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { getManpowerCategories, listPublicJobs } from "@/lib/publicApi";
import PublicJobCard from "./public-job-card";

const PAGE_SIZE = 9;

function errorMessageOf(error) {
  return error instanceof Error && error.message
    ? error.message
    : "Job openings could not be loaded right now.";
}

export default function CareersBrowser() {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listPublicJobs({ page: 0, size: PAGE_SIZE });
        if (cancelled) return;
        setJobs(data.content);
        setTotal(data.totalElements);
        setError("");
      } catch (caught) {
        if (cancelled) return;
        setJobs([]);
        setTotal(0);
        setError(errorMessageOf(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getManpowerCategories()
      .then((list) => {
        if (!cancelled) setCategories(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function fetchJobs(nextPage, nextCategoryId, nextCity) {
    setLoading(true);
    setError("");
    try {
      const data = await listPublicJobs({
        categoryId: nextCategoryId || undefined,
        city: nextCity || undefined,
        page: nextPage,
        size: PAGE_SIZE,
      });
      setJobs(data.content);
      setTotal(data.totalElements);
      setPage(nextPage);
    } catch (caught) {
      setJobs([]);
      setTotal(0);
      setError(errorMessageOf(caught));
    } finally {
      setLoading(false);
    }
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const current = Math.min(page + 1, totalPages);

  function applyFilters(event) {
    event.preventDefault();
    const nextCity = cityInput.trim();
    setCity(nextCity);
    fetchJobs(0, categoryId, nextCity);
  }

  function changeCategory(value) {
    setCategoryId(value);
    fetchJobs(0, value, city);
  }

  function goTo(nextPage) {
    if (nextPage < 0 || nextPage >= totalPages || loading) return;
    fetchJobs(nextPage, categoryId, city);
  }

  function refresh() {
    fetchJobs(page, categoryId, city);
  }

  return (
    <div className="careers-browser">
      <form className="careers-filters" onSubmit={applyFilters}>
        <label className="careers-field">
          <span>Category</span>
          <select value={categoryId} onChange={(event) => changeCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name || category.code || `Category #${category.id}`}
              </option>
            ))}
          </select>
        </label>
        <label className="careers-field">
          <span>City</span>
          <input
            type="text"
            value={cityInput}
            placeholder="e.g. Pune"
            onChange={(event) => setCityInput(event.target.value)}
          />
        </label>
        <button type="submit" className="button button-primary careers-search" disabled={loading}>
          <Search size={15} /> Search
        </button>
        <button type="button" className="button button-outline careers-search" onClick={refresh} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </form>

      {error && (
        <div className="section-feedback" role="alert">
          <span className="section-feedback-icon">
            <AlertCircle size={17} />
          </span>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <p className="careers-status">Loading open jobs…</p>
      ) : error ? null : jobs.length === 0 ? (
        <div className="careers-empty">
          <h3>No open vacancies right now</h3>
          <p>
            There are no jobs matching your filters at the moment. Please check back soon or adjust your search.
          </p>
        </div>
      ) : (
        <>
          <p className="careers-count">
            {total} job{total === 1 ? "" : "s"} found
          </p>
          <div className="job-grid">
            {jobs.map((job) => (
              <PublicJobCard key={job.slug || job.id || job.title} job={job} />
            ))}
          </div>
        </>
      )}

      {!loading && !error && total > PAGE_SIZE && (
        <div className="careers-pagination">
          <button
            type="button"
            className="button button-outline"
            onClick={() => goTo(page - 1)}
            disabled={page <= 0}
          >
            <ChevronLeft size={15} /> Previous
          </button>
          <span>
            Page {current} of {totalPages}
          </span>
          <button
            type="button"
            className="button button-outline"
            onClick={() => goTo(page + 1)}
            disabled={page + 1 >= totalPages}
          >
            Next <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
