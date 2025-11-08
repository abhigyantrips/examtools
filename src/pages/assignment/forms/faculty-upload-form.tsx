import { AlertCircle, CheckCircle, FileText, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import { useCallback, useState } from 'react';
import { useExamData } from '@/hooks/use-exam-data';

import type { ExcelParseResult, Faculty } from '@/types';

import { parseFacultyExcel } from '@/lib/excel';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface FacultyUploadFormProps {
  onFacultyUploaded: (faculty: Faculty[]) => void;
  currentFaculty: Faculty[];
}

export function FacultyUploadForm({
  onFacultyUploaded,
  currentFaculty,
}: FacultyUploadFormProps) {
  const { importMetadata } = useExamData();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ExcelParseResult<Faculty> | null>(null);

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        setResult({
          data: [],
          errors: ['Please upload an Excel file (.xlsx or .xls)'],
          warnings: [],
        });

        return;
      }

      setUploading(true);
      try {
        const parseResult = await parseFacultyExcel(file);
        setResult(parseResult);

        if (parseResult.data.length > 0 && parseResult.errors.length === 0) {
          onFacultyUploaded(parseResult.data);
          toast.success(
            `Successfully uploaded ${parseResult.data.length} faculty members.`
          );
          // Don't clear results immediately - let the parent handle the preview
        } else if (parseResult.errors.length > 0) {
          toast.error(`Upload failed: ${parseResult.errors[0]}`);
        } else if (parseResult.warnings.length > 0) {
          toast.warning(
            `Upload completed with ${parseResult.warnings.length} warnings.`
          );
        }
      } catch (error) {
        setResult({
          data: [],
          errors: [
            `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ],
          warnings: [],
        });
      } finally {
        setUploading(false);
      }
    },
    [onFacultyUploaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const handleImportSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !importMetadata) return;
      try {
        await importMetadata(file);
        toast.success('Metadata imported successfully');
      } catch (err) {
        toast.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [importMetadata]
  );

  const clearResults = useCallback(() => {
    setResult(null);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-5" />
          Faculty Upload
        </CardTitle>
        <CardDescription>
          Upload your faculty Excel file with columns: S No, Faculty Name,
          Faculty ID, Designation, Department, Phone No
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div
          className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            disabled={uploading}
          />

          <div className="space-y-3">
            <Upload className="text-muted-foreground mx-auto size-12" />
            <div>
              <p className="text-sm font-medium">
                {dragActive
                  ? 'Drop the file here'
                  : 'Drag and drop your Excel file here'}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                or click to browse files (.xlsx, .xls)
              </p>
            </div>
          </div>

          {uploading && (
            <div className="bg-background/80 absolute inset-0 flex items-center justify-center">
              <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          )}
        </div>

        {/* Current Faculty Status */}
        {currentFaculty.length > 0 && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/30">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle className="size-4" />
              <span className="text-sm font-medium">
                {currentFaculty.length} faculty members loaded
              </span>
            </div>
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
              Upload a new file to replace the current faculty list.
            </p>
          </div>
        )}

        {/* Upload Results */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Upload Results</h4>
              <Button variant="ghost" size="sm" onClick={clearResults}>
                <X className="size-4" />
              </Button>
            </div>

            {/* Success Message */}
            {result.data.length > 0 && result.errors.length === 0 && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="size-4" />
                <span className="text-sm">
                  Successfully uploaded {result.data.length} faculty members
                </span>
              </div>
            )}

            {/* Errors */}
            {result.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="size-4" />
                  <span className="text-sm font-medium">
                    Errors ({result.errors.length})
                  </span>
                </div>
                <ul className="space-y-1 pl-6 text-xs text-red-600">
                  {result.errors.map((error, index) => (
                    <li key={index} className="list-disc">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="size-4" />
                  <span className="text-sm font-medium">
                    Warnings ({result.warnings.length})
                  </span>
                </div>
                <ul className="space-y-1 pl-6 text-xs text-yellow-600">
                  {result.warnings.slice(0, 5).map((warning, index) => (
                    <li key={index} className="list-disc">
                      {warning}
                    </li>
                  ))}
                  {result.warnings.length > 5 && (
                    <li className="text-muted-foreground text-xs">
                      ...and {result.warnings.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Data Preview */}
            {result.data.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium">
                  Preview (first 3 records)
                </span>
                <div className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">
                  {result.data.slice(0, 3).map((faculty, index) => (
                    <div key={index} className="mb-2">
                      {faculty.facultyName} ({faculty.facultyId}) -{' '}
                      {faculty.designation}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Import metadata (JSON or ZIP) */}
        <div className="pt-2">
          <label className="inline-flex items-center gap-2">
            <input
              type="file"
              accept=".json,.zip"
              onChange={handleImportSelect}
              className="hidden"
            />
            <Button asChild variant="outline" size="sm">
              <span>
                <FileText className="mr-2 inline-block" /> Import metadata (JSON / ZIP)
              </span>
            </Button>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
