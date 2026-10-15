"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, RefreshCw, UploadCloud, X } from "lucide-react";
import { CandidateApiError, MAX_RESUME_BYTES, uploadResume, validateResumeFile } from "@/lib/candidateApi";
import { ErrorState, Spinner } from "./candidate-ui";

function humanSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CandidateResume({ profile, loading, error, onRefresh, onUploaded }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");

  function pickFile() {
    if (uploading) return;
    inputRef.current?.click();
  }

  function onInputChange(event) {
    const selected = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    setUploadError("");
    setNotice("");
    if (!selected) {
      setFile(null);
      setFileError("");
      return;
    }
    const validationError = validateResumeFile(selected);
    if (validationError) {
      setFile(null);
      setFileError(validationError);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFileError("");
    setFile(selected);
  }

  function clearSelection() {
    setFile(null);
    setFileError("");
    setUploadError("");
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleUpload() {
    if (uploading) return;
    const validationError = validateResumeFile(file);
    if (validationError) {
      setFileError(validationError);
      return;
    }
    setUploading(true);
    setUploadError("");
    setNotice("");
    setProgress(0);
    try {
      const updated = await uploadResume(file, { onProgress: setProgress });
      setNotice("Your resume has been uploaded.");
      clearSelection();
      onUploaded(updated);
    } catch (caught) {
      const message =
        caught instanceof CandidateApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Your resume could not be uploaded. Please try again.";
      setUploadError(message);
      setProgress(0);
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <Spinner label="Loading your resume…" />;
  if (error) return <ErrorState message={error} onRetry={onRefresh} />;

  const hasResume = Boolean(profile && profile.resumeDocumentId);
  const resumeName = (profile && profile.resumeFileName) || "Resume.pdf";

  return (
    <section className="cp-panel">
      <div className="cp-panelHead">
        <div>
          <h2>My resume</h2>
          <p>Upload a PDF resume. Employers see it with every application you submit.</p>
        </div>
      </div>

      {notice && (
        <div className="authAlert authAlert--success" role="status">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      )}
      {uploadError && (
        <div className="authAlert authAlert--error" role="alert">
          <AlertCircle size={16} />
          {uploadError}
        </div>
      )}

      <div className={`cp-resumeCard${hasResume ? " cp-resumeCard--ready" : ""}`}>
        <div className="cp-resumeIcon" aria-hidden="true">
          <FileText size={22} />
        </div>
        <div className="cp-resumeInfo">
          <strong>{hasResume ? resumeName : "No resume uploaded yet"}</strong>
          <span>
            {hasResume
              ? `Document #${profile.resumeDocumentId} · current resume attached to new applications`
              : "PDF only, up to 10 MB. You need a resume before you can apply for a job."}
          </span>
        </div>
        <button type="button" className="authButtonSecondary cp-inlineButton" onClick={pickFile} disabled={uploading}>
          {hasResume ? <RefreshCw size={14} /> : <UploadCloud size={14} />}
          {hasResume ? "Replace resume" : "Upload resume"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="cp-fileInput"
        onChange={onInputChange}
        disabled={uploading}
      />

      {fileError && (
        <div className="authAlert authAlert--error" role="alert">
          <AlertCircle size={16} />
          {fileError}
        </div>
      )}

      {file && (
        <div className="cp-uploadRow">
          <div className="cp-uploadMeta">
            <FileText size={15} />
            <span className="cp-uploadName">{file.name}</span>
            <span className="cp-uploadSize">{humanSize(file.size)}</span>
            {!uploading && (
              <button type="button" className="cp-iconButton" aria-label="Remove selected file" onClick={clearSelection}>
                <X size={15} />
              </button>
            )}
          </div>
          {uploading && (
            <div className="cp-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <span className="cp-progressBar" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="cp-uploadActions">
            <button type="button" className="authButton" onClick={handleUpload} disabled={uploading}>
              <UploadCloud size={15} /> {uploading ? `Uploading… ${progress}%` : hasResume ? "Replace resume" : "Upload resume"}
            </button>
          </div>
        </div>
      )}

      <p className="cp-hint" style={{ marginTop: 16 }}>
        Maximum size: {humanSize(MAX_RESUME_BYTES)}. The file is checked by content, so renaming a non-PDF will not bypass validation.
        Each past application keeps the resume you sent with it.
      </p>
    </section>
  );
}
