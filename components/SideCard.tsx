"use client";

import { FileRef } from "@/lib/types";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SideCardProps {
  fileRef: FileRef;
  onRemove: (fileId: string) => void;
}

export function SideCard({ fileRef, onRemove }: SideCardProps) {
  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    return <FileText className="h-6 w-6" />;
  };

  return (
    <div className="bg-background/90 backdrop-blur-sm border rounded-lg p-4 shadow-lg min-w-[200px] max-w-[250px] animate-in slide-in-from-right">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 text-muted-foreground">
            {getFileIcon(fileRef.filename)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{fileRef.filename}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Added to session
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={() => onRemove(fileRef.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}




