import { useState, useCallback } from 'react';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { parseFacultyExcel } from '@/lib/excel';
import type { Faculty, ExcelParseResult } from '@/types';

interface FacultyUploadFormProps {
  onFacultyUploaded: (faculty: Faculty[]) => void;
  currentFaculty: Faculty[];
}

export function FacultyUploadForm({ onFacultyUploaded, currentFaculty }: FacultyUploadFormProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ExcelParseResult<Faculty> | null>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setResult({
        data: [],
        errors: ['Please upload an Excel file (.xlsx or .xls)'],
        warnings: []
      });
      return;
    }

    setUploading(true);
    try {
      const parseResult = await parseFacultyExcel(file);
      setResult(parseResult);
      
      if (parseResult.data.length > 0 && parseResult.errors.length === 0) {
        onFacultyUploaded(parseResult.data);
      }
    } catch (error) {
      setResult({
        data: [],
        errors: [`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      });
    } finally {
      setUploading(false);
    }
  }, [onFacultyUploaded]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const clearResults = useCallback(() => {
    setResult(null);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Faculty Upload</CardTitle>
        <CardDescription>
          Upload Excel file with faculty information. Required columns: S No, Faculty Name, Faculty ID, Designation, Department, Phone No
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
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
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploading}
          />
          
          <div className="space-y-3">
            <Upload className="mx-auto size-12 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {dragActive ? 'Drop the file here' : 'Drag and drop your Excel file here'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                or click to browse files (.xlsx, .xls)
              </p>
            </div>
          </div>
          
          {uploading && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <div className="animate-spin size-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}
        </div>

        {/* Current Faculty Count */}
        {currentFaculty.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Currently loaded: {currentFaculty.length} faculty members
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
                <span className="text-sm">Successfully uploaded {result.data.length} faculty members</span>
              </div>
            )}

            {/* Errors */}
            {result.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="size-4" />
                  <span className="text-sm font-medium">Errors ({result.errors.length})</span>
                </div>
                <ul className="text-xs text-red-600 space-y-1 pl-6">
                  {result.errors.map((error, index) => (
                    <li key={index} className="list-disc">{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="size-4" />
                  <span className="text-sm font-medium">Warnings ({result.warnings.length})</span>
                </div>
                <ul className="text-xs text-yellow-600 space-y-1 pl-6">
                  {result.warnings.slice(0, 5).map((warning, index) => (
                    <li key={index} className="list-disc">{warning}</li>
                  ))}
                  {result.warnings.length > 5 && (
                    <li className="text-xs text-muted-foreground">
                      ...and {result.warnings.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Data Preview */}
            {result.data.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium">Preview (first 3 records)</span>
                <div className="text-xs font-mono bg-muted p-3 rounded-md overflow-x-auto">
                  {result.data.slice(0, 3).map((faculty, index) => (
                    <div key={index} className="mb-2">
                      {faculty.facultyName} ({faculty.facultyId}) - {faculty.designation}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}