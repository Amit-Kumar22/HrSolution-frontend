"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { IdCard, RefreshCw, Search, ShieldCheck } from "lucide-react";
import WorkerDetailDrawer from "@/app/admin/worker-detail";
import { workerCapabilities } from "@/lib/workerApi";

const STORAGE_KEY = "shakti.workerProfileId";
const CHANGE_EVENT = "shakti:worker-profile-change";

function readStoredWorkerId() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function subscribeToWorkerId(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getServerWorkerId() {
  return "";
}

function persistWorkerId(workerId) {
  try {
    if (workerId) window.sessionStorage.setItem(STORAGE_KEY, workerId);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return true;
}

export default function CandidateWorkerProfile({ session }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const workerId = useSyncExternalStore(subscribeToWorkerId, readStoredWorkerId, getServerWorkerId);
  const capabilities = useMemo(() => workerCapabilities(session), [session]);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!/^[1-9][0-9]*$/.test(trimmed)) {
      setError("Enter the numeric Worker ID provided by your HR team.");
      return;
    }
    if (!persistWorkerId(trimmed)) {
      setError("This browser could not remember the Worker ID. Allow site storage and try again.");
      return;
    }
    setError("");
  }

  function handleForget() {
    persistWorkerId("");
    setInput("");
    setError("");
  }

  return (
    <div className="cp-stack">
      <section className="cp-panel">
        <div className="cp-panelHead">
          <h2>My Worker Profile</h2>
          <p>
            View the worker record your HR team maintains for you. Enter the Worker ID they shared when you joined.
          </p>
        </div>

        {!workerId ? (
          <form className="cp-form" onSubmit={handleSubmit} noValidate>
            <div className="authField authField--full">
              <label className="authLabel" htmlFor="candidateWorkerId">Worker ID</label>
              <input
                id="candidateWorkerId"
                className={`authInput${error ? " authInputError" : ""}`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="For example, 1024"
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  if (error) setError("");
                }}
              />
            </div>
            {error && <p className="cp-state cp-state--error" role="alert">{error}</p>}
            <p className="cp-inlineNote">
              This is an internal worker number, not your phone number. Contact HR if you do not know it.
            </p>
            <div className="authButtonRow cp-formActions">
              <button type="submit" className="authButton">
                <Search size={15} /> Find my profile
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="cp-workerToolbar">
              <span>
                <ShieldCheck size={15} /> Viewing Worker #{workerId} - read only
              </span>
              <button type="button" className="authButtonSecondary" onClick={handleForget}>
                <RefreshCw size={14} /> Use a different ID
              </button>
            </div>
            <p className="cp-inlineNote">
              <IdCard size={14} /> Documents and bank accounts are visible but cannot be changed here. Ask HR for corrections.
            </p>
            <WorkerDetailDrawer
              key={workerId}
              workerId={workerId}
              capabilities={capabilities}
              selfWorkerId={workerId}
              inline
            />
          </>
        )}
      </section>
    </div>
  );
}
