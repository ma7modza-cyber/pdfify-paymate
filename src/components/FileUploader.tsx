import { useDropzone } from 'react-dropzone';
import { cn } from "@/lib/utils";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

const FileUploader = ({ onFileSelect, isProcessing }: FileUploaderProps) => {
  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    onDrop: files => {
      if (files[0]) {
        onFileSelect(files[0]);
        toast.success("File uploaded successfully!");
      }
    }
  });

  const currentFile = acceptedFiles[0];

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
        isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400",
        isProcessing && "pointer-events-none opacity-50"
      )}
    >
      <input {...getInputProps()} />
      {isProcessing ? (
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="mt-2 text-gray-600">Converting your file...</p>
        </div>
      ) : currentFile ? (
        <div className="flex flex-col items-center">
          <FileText className="h-12 w-12 text-blue-500 mb-4" />
          <p className="text-lg font-medium text-gray-900">
            {currentFile.name}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Click or drop to replace file
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              />
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-900">
            Drop your file here, or click to browse
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Supports Excel (.xlsx) and Word (.docx) files
          </p>
        </div>
      )}
    </div>
  );
};

export default FileUploader;