"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";

interface FileUploadProps {
  bucketId: string | null;
  onFilesChange: (files: File[]) => void;
}

export function FileUpload({ bucketId, onFilesChange }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
    onFilesChange([...selectedFiles, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesChange(newFiles);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles((prev) => [...prev, ...files]);
    onFilesChange([...selectedFiles, ...files]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div className="border-t p-2">
      <div
        className="border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary transition-colors"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Upload className="h-4 w-4" />
          <span>Drop files here or click to upload</span>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-2 space-y-1">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-muted rounded px-2 py-1 text-sm"
            >
              <span className="truncate flex-1">{file.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile(index);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

