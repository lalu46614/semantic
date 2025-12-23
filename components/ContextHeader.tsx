"use client";

interface ContextHeaderProps {
  bucketName: string | null;
}

export function ContextHeader({ bucketName }: ContextHeaderProps) {
  if (!bucketName) {
    return (
      <div className="border-b bg-muted/30 px-4 py-2">
        <p className="text-sm text-muted-foreground">
          Current Context: <span className="font-medium">No active context</span>
        </p>
      </div>
    );
  }

  return (
    <div className="border-b bg-muted/30 px-4 py-2">
      <p className="text-sm text-muted-foreground">
        Current Context: <span className="font-medium text-foreground">{bucketName}</span>
      </p>
    </div>
  );
}

