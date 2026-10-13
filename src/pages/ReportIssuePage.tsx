import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ROUTES, CIVIC_ISSUE_CATEGORIES, CHANDIGARH_SECTORS } from '../constants';
import { PageContainer } from '../components/ui/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Badge } from '../components/ui/Badge';
import {
  UploadCloud,
  MapPin,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  X,
  AlertCircle,
  FileText,
  Navigation,
  ArrowRight,
  RefreshCw,
  Clock,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { createComplaint, validateComplaintInput } from '../services/complaintsService';
import type { ComplaintRow } from '../types/database';

interface SubmissionSuccessData {
  complaint: ComplaintRow;
  trackingId: string;
  imageFileName?: string;
  imagePreviewUrl?: string | null;
}

export const ReportIssuePage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [sector, setSector] = useState('Sector 17');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');

  // Image State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<SubmissionSuccessData | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate(ROUTES.LOGIN, { state: { from: location.pathname } });
    }
  }, [authLoading, isAuthenticated, navigate, location.pathname]);

  // File Handling
  const handleFileSelection = (file: File) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setFormError('Unsupported file type. Please upload a JPG, JPEG, PNG, or WEBP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFormError('File size exceeds 10MB limit. Please upload a smaller image.');
      return;
    }
    setFormError(null);
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemoveImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit Handler connected to real Supabase service
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      setFormError('Your session has expired. Please sign in again.');
      navigate(ROUTES.LOGIN, { state: { from: location.pathname } });
      return;
    }

    const validation = validateComplaintInput({
      title,
      description,
      category,
      sector,
      evidenceFile: imageFile,
    });

    if (validation) {
      setFormError(validation);
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      const result = await createComplaint({
        title,
        description,
        category,
        sector,
        landmark: landmark || undefined,
        streetAddress: address || undefined,
        evidenceFile: imageFile,
      });

      if (result.error || !result.data) {
        setFormError(result.error?.message || 'Failed to submit grievance. Please try again.');
        setIsSubmitting(false);
        return;
      }

      setSuccessData({
        complaint: result.data.complaint,
        trackingId: result.data.trackingId,
        imageFileName: imageFile?.name,
        imagePreviewUrl: result.data.evidenceSignedUrl || imagePreviewUrl,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An unexpected error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setSector('Sector 17');
    setAddress('');
    setLandmark('');
    handleRemoveImage();
    setSuccessData(null);
    setFormError(null);
  };

  // Unauthenticated fallback view
  if (!authLoading && !isAuthenticated) {
    return (
      <PageContainer maxWidth="md" className="py-16">
        <Card className="text-center p-8 border-slate-200">
          <div className="h-14 w-14 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Citizen Sign-In Required</h2>
          <p className="text-xs text-slate-600 mt-2 max-w-md mx-auto">
            You must be signed in with a resident account to submit a civic complaint and receive real-time status tracking.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to={ROUTES.LOGIN} state={{ from: location.pathname }}>
              <Button variant="primary" size="md">
                Sign In to Continue
              </Button>
            </Link>
          </div>
        </Card>
      </PageContainer>
    );
  }

  // Confirmation screen after real Supabase persistence
  if (successData) {
    const { complaint, trackingId, imageFileName, imagePreviewUrl: previewUrl } = successData;

    return (
      <PageContainer maxWidth="md" className="py-12">
        <Card className="text-center p-8 sm:p-10 border-emerald-200 bg-emerald-50/20">
          <div className="h-16 w-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-5 shadow-xs">
            <CheckCircle2 className="h-9 w-9" />
          </div>

          <Badge variant="success" size="md" className="mb-3">
            Grievance Registered Successfully
          </Badge>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Intake Logged & Stored
          </h2>

          <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
            Your civic complaint has been committed to the Chandigarh municipal database and queued for
            intake processing.
          </p>

          <div className="my-6 p-4 rounded-lg bg-white border border-slate-200 max-w-md mx-auto text-left shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Tracking Number:</span>
              <span className="font-mono text-sm font-bold text-blue-900 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                {trackingId}
              </span>
            </div>
            <div className="pt-3 space-y-2 text-xs text-slate-700">
              <div>
                <strong>Title:</strong> {complaint.title}
              </div>
              <div>
                <strong>Category:</strong> {complaint.category}
              </div>
              <div>
                <strong>Location:</strong> {complaint.sector}{' '}
                {complaint.street_address ? `• ${complaint.street_address}` : ''}
              </div>
              <div>
                <strong>Status:</strong>{' '}
                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-medium border border-slate-200">
                  {complaint.status}
                </span>
              </div>
              {imageFileName && (
                <div className="text-emerald-700 flex items-center gap-1.5 mt-2 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Photographic evidence securely uploaded ({imageFileName})</span>
                </div>
              )}
            </div>

            {previewUrl && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-500 block mb-1.5 font-medium">
                  Uploaded Evidence Thumbnail:
                </span>
                <img
                  src={previewUrl}
                  alt="Evidence preview"
                  className="h-28 w-auto rounded border border-slate-200 object-cover"
                />
              </div>
            )}
          </div>

          {/* AI Evidence Analysis Notice (Truthful, non-simulated) */}
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-950 max-w-md mx-auto mb-6 text-left space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-blue-900">
              <Clock className="h-4 w-4 text-blue-700" />
              AI Evidence Analysis: Pending Pipeline Processing
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              Your grievance has been recorded with status <strong>submitted</strong> and <strong>Priority: Pending AI Analysis</strong>.
              Photographic evidence is preserved in private municipal storage. Automated visual corroboration
              and deterministic priority calculation will be executed once the backend inference pipeline processes the intake.
              In accordance with municipal transparency principles, no automated priority scores have been invented.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to={ROUTES.COMPLAINT_DETAILS(complaint.id)}>
              <Button variant="primary" size="md" rightIcon={<ArrowRight className="h-4 w-4" />}>
                View Complaint Tracking Details
              </Button>
            </Link>
            <Link to={ROUTES.MY_COMPLAINTS}>
              <Button variant="outline" size="md">
                My Complaints List
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="md"
              onClick={handleResetForm}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Report Another Issue
            </Button>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      maxWidth="lg"
      headerTitle="Report a Civic Problem"
      headerDescription="Submit photographic evidence, describe the municipal hazard, and specify the Chandigarh location for AI-assisted prioritization."
    >
      <form onSubmit={handleSubmit} className="space-y-8">
        {formError && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Submission Error</span>
              <span>{formError}</span>
            </div>
          </div>
        )}

        {/* SECTION A: ISSUE INFORMATION */}
        <Card>
          <CardHeader
            title="A. Issue Information"
            subtitle="Categorize the hazard and describe what needs repair"
          />

          <div className="space-y-4">
            <div>
              <label
                htmlFor="issue-category"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Civic Category <span className="text-red-500">*</span>
              </label>
              <select
                id="issue-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="" disabled>
                  Select civic grievance category
                </option>
                {CIVIC_ISSUE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Input
                label="Issue Title"
                placeholder="e.g. Deep cavity and collapsed storm grate in road"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
                helperText="Provide a concise summary of the problem (max 200 characters)"
              />
            </div>

            <div>
              <Textarea
                label="Detailed Description"
                placeholder="Describe the condition, approximate size, time noticed, and whether it creates immediate danger for commuters, two-wheelers, or pedestrians..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
                maxLength={2500}
                helperText={`${description.length} characters (min 10) • Mention any life-safety hazards or previous incidents`}
              />
            </div>
          </div>
        </Card>

        {/* SECTION B: EVIDENCE */}
        <Card>
          <CardHeader
            title="B. Photographic Evidence (Optional)"
            subtitle="Upload a clear photograph of the issue to private storage"
            action={
              <Badge variant="neutral" size="sm">
                Private Storage Bucket
              </Badge>
            }
          />

          <div className="space-y-4">
            <p className="text-xs text-slate-600 font-medium">
              Upload a clear photograph of the civic issue. Photographic evidence is stored in a private Supabase bucket and will be analyzed during AI triage.
            </p>

            {/* Hidden native input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelection(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            {!imagePreviewUrl ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-slate-300 bg-slate-50/60 hover:bg-slate-100/70 hover:border-slate-400'
                }`}
              >
                <UploadCloud className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                <div className="text-sm font-semibold text-slate-800">
                  Drag and drop photograph here, or{' '}
                  <span className="text-blue-600 underline">browse computer</span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Supported formats: JPG, JPEG, PNG, WEBP (Max 10MB)
                </p>
                <div className="mt-4">
                  <Button type="button" variant="outline" size="sm">
                    Select Image File
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-slate-900 max-h-72 flex items-center justify-center">
                  <img
                    src={imagePreviewUrl}
                    alt="Uploaded civic evidence preview"
                    className="max-h-72 w-auto object-contain mx-auto"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-3 right-3 bg-slate-900/80 hover:bg-red-600 text-white p-1.5 rounded-full backdrop-blur-xs transition-colors"
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 px-1">
                  <span className="font-mono">
                    {imageFile?.name} ({(imageFile ? imageFile.size / 1024 : 0).toFixed(1)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="text-red-600 hover:underline font-medium"
                  >
                    Remove and change photo
                  </button>
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-md border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Evidence Privacy:</strong> Evidence files are stored in a private bucket with Row Level Security. Only you and authorized municipal officers can view the uploaded image.
              </span>
            </div>
          </div>
        </Card>

        {/* SECTION C: LOCATION */}
        <Card>
          <CardHeader
            title="C. Location Information"
            subtitle="Specify the Chandigarh sector and nearby landmark"
          />

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="sector-select"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Sector <span className="text-red-500">*</span>
                </label>
                <select
                  id="sector-select"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {CHANDIGARH_SECTORS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Input
                  label="Nearby Landmark (Optional)"
                  placeholder="e.g. Opposite State Bank Plaza, Gate 2"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  helperText="Prominent landmark helps municipal inspection crews"
                />
              </div>
            </div>

            <div>
              <Input
                label="Street / Corridor Address (Optional)"
                placeholder="e.g. Inner Service Lane between SCO 142 and 144"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Location Selection (UI Placeholder)
              </label>
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 text-xs text-slate-600">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    Target Sector Grid: {sector}
                  </span>
                  <span className="text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Geospatial Pinpoint
                  </span>
                </div>

                <div className="bg-slate-200/70 border border-slate-300 rounded h-24 flex flex-col items-center justify-center text-center p-4">
                  <Navigation className="h-5 w-5 text-slate-400 mb-1" />
                  <span className="font-medium text-slate-700">Geospatial Sector Grid</span>
                  <span className="text-[11px] text-slate-500 mt-0.5">
                    Coordinates map to {sector}, Union Territory of Chandigarh
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* SECTION D: AI ANALYSIS NOTICE */}
        <Card className="border-blue-200 bg-blue-50/40">
          <div className="flex items-start gap-3.5">
            <div className="p-2 bg-blue-100 text-blue-800 rounded-lg shrink-0 mt-0.5">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-blue-950">AI Multimodal Pipeline Overview</h3>
              <p className="text-xs text-blue-900 mt-1 leading-relaxed">
                After submission, Chandigarh CivicAI will evaluate your grievance in Phase 6 to compute objective
                severity, safety risk, and evidence support factors for municipal triage.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="bg-white/80 border border-blue-200 text-blue-800 px-2 py-0.5 rounded font-medium">
                  • Severity Estimation (Phase 6)
                </span>
                <span className="bg-white/80 border border-blue-200 text-blue-800 px-2 py-0.5 rounded font-medium">
                  • Public Safety Risk (Phase 6)
                </span>
                <span className="bg-white/80 border border-blue-200 text-blue-800 px-2 py-0.5 rounded font-medium">
                  • Evidence Corroboration (Phase 6)
                </span>
                <span className="bg-white/80 border border-blue-200 text-blue-800 px-2 py-0.5 rounded font-medium">
                  • Deterministic Priority Score (Phase 6)
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* SECTION E: SUBMIT BUTTON */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Link to={ROUTES.CITIZEN_DASHBOARD}>
            <Button type="button" variant="outline" size="md">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            leftIcon={!isSubmitting ? <FileText className="h-4 w-4" /> : undefined}
          >
            {isSubmitting ? 'Registering Grievance in Database...' : 'Submit Civic Complaint'}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
};
export default ReportIssuePage;
